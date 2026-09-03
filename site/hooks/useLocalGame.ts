"use client";

import { useCallback, useEffect, useState } from "react";
import { createGame, publicSnapshot, reduceGame, replayGame } from "@/lib/game/engine";
import type { DomainEvent, GameAction, GameState } from "@/lib/game/types";

const STORAGE_KEY = "peak-auction:local:v1";
const DEFAULT_PLAYERS = {
  A: { nickname: "青队" },
  B: { nickname: "珊瑚队" },
} as const;

type StoredLocalGame = {
  schemaVersion: 1;
  seed: string;
  events: DomainEvent[];
};

function freshSeed() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `local-${crypto.randomUUID()}`
    : `local-${Date.now()}`;
}

export function restoreLocalGame(raw: string): GameState {
  const parsed = JSON.parse(raw) as Partial<StoredLocalGame>;
  if (
    parsed.schemaVersion !== 1 ||
    typeof parsed.seed !== "string" ||
    !parsed.seed.trim() ||
    !Array.isArray(parsed.events) ||
    parsed.events[0]?.type !== "GAME_CREATED"
  ) {
    throw new Error("Invalid local game record");
  }
  return replayGame(parsed.seed, parsed.events);
}

export function useLocalGame() {
  const [state, setState] = useState<GameState>(() =>
    createGame("local-preview", DEFAULT_PLAYERS),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          setState(restoreLocalGame(raw));
        } catch {
          window.localStorage.removeItem(STORAGE_KEY);
          setState(createGame(freshSeed(), DEFAULT_PLAYERS));
          setNotice("本地记录损坏，已安全重开一局。");
        }
      } else {
        setState(createGame(freshSeed(), DEFAULT_PLAYERS));
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const record: StoredLocalGame = {
      schemaVersion: 1,
      seed: state.seed,
      events: state.eventLog,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  }, [hydrated, state]);

  const dispatch = useCallback((action: GameAction) => {
    setState((current) => reduceGame(current, action).state);
    setNotice(null);
  }, []);

  const reset = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setState(createGame(freshSeed(), DEFAULT_PLAYERS));
    setNotice("已开始一局新的同机对战。");
  }, []);

  return { snapshot: publicSnapshot(state), dispatch, reset, notice };
}
