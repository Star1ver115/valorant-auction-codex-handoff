"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameAction, PublicGameSnapshot } from "@/lib/game/types";
import type { JoinKind, RoomRole, SnapshotResponse } from "@/lib/server/rooms";

const SESSION_KEY = "peak-auction:room:v1";

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type OnlineSession = { code: string; seatToken: string; role: RoomRole };
type ActionInput = OnlineSession & {
  expectedVersion: number;
  actionId: string;
  action: GameAction;
};

export function pollDelayForVisibility(state: DocumentVisibilityState) {
  return state === "visible" ? 750 : 4000;
}

export function restoreOnlineSession(storage: Pick<Storage, "getItem">): OnlineSession | null {
  try {
    const raw = storage.getItem(SESSION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<OnlineSession>;
    if (
      typeof value.code !== "string" ||
      !/^[A-Z0-9]{6}$/iu.test(value.code) ||
      typeof value.seatToken !== "string" ||
      !value.seatToken ||
      (value.role !== "A" && value.role !== "B" && value.role !== "SPECTATOR")
    ) return null;
    return { code: value.code.toUpperCase(), seatToken: value.seatToken, role: value.role };
  } catch {
    return null;
  }
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  return body;
}

export async function submitOnlineAction(fetcher: Fetcher, input: ActionInput) {
  const response = await fetcher(`/api/rooms/${input.code}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      seatToken: input.seatToken,
      expectedVersion: input.expectedVersion,
      actionId: input.actionId,
      action: input.action,
    }),
  });
  const body = await response.json() as SnapshotResponse & {
    current?: SnapshotResponse;
    error?: { message?: string };
  };
  if (response.status === 409 && body.current) {
    return { conflict: true as const, response: body.current };
  }
  if (!response.ok) throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  return { conflict: false as const, response: body };
}

export function useOnlineRoom() {
  const [session, setSession] = useState<OnlineSession | null>(null);
  const [room, setRoom] = useState<SnapshotResponse | null>(null);
  const [connection, setConnection] = useState<"IDLE" | "CONNECTING" | "CONNECTED" | "RECONNECTING" | "ERROR">("IDLE");
  const [message, setMessage] = useState<string | null>(null);
  const failures = useRef(0);
  const restoredOnce = useRef(false);

  const saveSession = useCallback((next: OnlineSession | null) => {
    setSession(next);
    if (next) sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else sessionStorage.removeItem(SESSION_KEY);
  }, []);

  const reconnect = useCallback(async (active = session) => {
    if (!active) return;
    setConnection((value) => value === "CONNECTED" ? "RECONNECTING" : "CONNECTING");
    try {
      const response = await fetch(`/api/rooms/${active.code}`, { cache: "no-store" });
      const latest = await responseJson<SnapshotResponse>(response);
      setRoom(latest);
      setConnection("CONNECTED");
      setMessage(null);
      failures.current = 0;
    } catch (error) {
      failures.current += 1;
      setConnection("ERROR");
      setMessage(error instanceof Error ? error.message : "房间连接失败");
    }
  }, [session]);

  useEffect(() => {
    if (restoredOnce.current) return;
    restoredOnce.current = true;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const restored = restoreOnlineSession(sessionStorage);
      if (restored) {
        saveSession(restored);
        void reconnect(restored);
      }
    });
    return () => { cancelled = true; };
  }, [reconnect, saveSession]);

  useEffect(() => {
    if (!session) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const schedule = () => {
      const base = pollDelayForVisibility(document.visibilityState);
      const delay = Math.min(base * 2 ** failures.current, 10_000);
      timer = setTimeout(async () => {
        await reconnect(session);
        if (!cancelled) schedule();
      }, delay);
    };
    const reschedule = () => {
      if (timer) clearTimeout(timer);
      schedule();
    };
    schedule();
    document.addEventListener("visibilitychange", reschedule);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", reschedule);
    };
  }, [reconnect, session]);

  const create = useCallback(async (nickname: string) => {
    setConnection("CONNECTING");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      });
      const joined = await responseJson<SnapshotResponse & OnlineSession>(response);
      saveSession({ code: joined.code, seatToken: joined.seatToken, role: joined.role });
      setRoom(joined);
      setConnection("CONNECTED");
      setMessage(null);
    } catch (error) {
      setConnection("ERROR");
      setMessage(error instanceof Error ? error.message : "创建房间失败");
    }
  }, [saveSession]);

  const join = useCallback(async (code: string, nickname: string, requestedRole: JoinKind) => {
    setConnection("CONNECTING");
    try {
      const roomCode = code.trim().toUpperCase();
      const response = await fetch(`/api/rooms/${roomCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, requestedRole }),
      });
      const joined = await responseJson<SnapshotResponse & OnlineSession>(response);
      saveSession({ code: joined.code, seatToken: joined.seatToken, role: joined.role });
      setRoom(joined);
      setConnection("CONNECTED");
      setMessage(null);
    } catch (error) {
      setConnection("ERROR");
      setMessage(error instanceof Error ? error.message : "加入房间失败");
    }
  }, [saveSession]);

  const submit = useCallback(async (action: GameAction) => {
    if (!session || !room) return undefined;
    setConnection("CONNECTING");
    try {
      const result = await submitOnlineAction(fetch, {
        ...session,
        expectedVersion: room.version,
        actionId: crypto.randomUUID(),
        action,
      });
      setRoom(result.response);
      setConnection("CONNECTED");
      setMessage(result.conflict ? "房间已同步到最新状态，请重试操作。" : null);
      return result.response.snapshot;
    } catch (error) {
      setConnection("ERROR");
      setMessage(error instanceof Error ? error.message : "提交操作失败");
    }
  }, [room, session]);

  const setSpectatorsOpen = useCallback(async (open: boolean) => {
    if (!session || session.role !== "A") return;
    try {
      const response = await fetch(`/api/rooms/${session.code}/spectators`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatToken: session.seatToken, open }),
      });
      setRoom(await responseJson<SnapshotResponse>(response));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "观战设置失败");
    }
  }, [session]);

  const leave = useCallback(() => {
    saveSession(null);
    setRoom(null);
    setConnection("IDLE");
    setMessage(null);
  }, [saveSession]);

  return {
    snapshot: room?.snapshot as PublicGameSnapshot | undefined,
    connection,
    code: session?.code ?? null,
    role: session?.role ?? null,
    spectatorCount: room?.spectatorCount ?? 0,
    spectatorsOpen: room?.spectatorsOpen ?? true,
    message,
    create,
    join,
    submit,
    reconnect: () => reconnect(),
    setSpectatorsOpen,
    leave,
  };
}
