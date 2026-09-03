"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GameAction } from "@/lib/game/types";

export type LobbyOnline = {
  connection: string;
  code: string | null;
  role: "A" | "B" | "SPECTATOR" | null;
  spectatorCount: number;
  spectatorsOpen: boolean;
  playerReady?: boolean;
  onCreate: (nickname: string) => void;
  onJoin: (code: string, nickname: string, role: "PLAYER" | "SPECTATOR") => void;
  onLeave: () => void;
  onAction?: (action: GameAction) => void;
};

export function Lobby({ onStart, online }: { onStart: () => void; online?: LobbyOnline }) {
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState("");
  const connected = Boolean(online?.code);
  return (
    <section className="mx-auto grid w-full max-w-5xl gap-6 px-5 py-10 lg:grid-cols-[1.25fr_.75fr] lg:py-20">
      <div className="broadcast-panel relative overflow-hidden p-7 sm:p-10">
        <div className="absolute right-0 top-0 h-full w-2 bg-team-b" />
        <p className="eyebrow">UNOFFICIAL STRATEGY SIMULATOR</p>
        <h1 aria-label="巅峰选手拍卖" className="mt-5 max-w-3xl text-4xl font-black uppercase leading-[.94] tracking-[-.05em] sm:text-7xl">
          巅峰选手
          <span className="block text-team-a">拍卖</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          两名玩家各持 20 块虚拟预算，公开竞价组建五人阵容。随后由同一确定性引擎完成地图 BP、特工分配与 BO5。
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {!connected ? (
            <Button onClick={onStart} size="lg" className="h-12 px-7 text-base font-bold">开始同机双人</Button>
          ) : online?.role === "A" ? (
            <Button disabled={!online.playerReady} onClick={onStart} size="lg" className="h-12 px-7 text-base font-bold">
              {online.playerReady ? "开始在线拍卖" : "等待玩家 B"}
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">等待房主开始拍卖</span>
          )}
          {connected ? <Button variant="outline" size="lg" className="h-12" onClick={online?.onLeave}>退出房间</Button> : null}
        </div>
      </div>

      <aside className="broadcast-panel grid content-between gap-8 p-7">
        <div>
          <p className="eyebrow text-analysis">MATCH DESK</p>
          <h2 className="mt-3 text-2xl font-bold">{connected ? `房间 ${online?.code}` : "在线房间"}</h2>
        </div>
        {connected ? (
          <div className="grid gap-3 text-sm">
            <p>连接状态：{online?.connection}</p>
            <p>{online?.role === "SPECTATOR" ? "只读观战" : `玩家席位 ${online?.role}`}</p>
            <p>观众 {online?.spectatorCount}/3 · {online?.spectatorsOpen ? "开放加入" : "已关闭加入"}</p>
          </div>
        ) : (
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm font-semibold" htmlFor="online-nickname">
              昵称
              <Input id="online-nickname" value={nickname} maxLength={24} onChange={(event) => setNickname(event.target.value)} />
            </label>
            <label className="grid gap-1 text-sm font-semibold" htmlFor="room-code">
              房间码
              <Input id="room-code" value={code} maxLength={6} onChange={(event) => setCode(event.target.value.toUpperCase())} />
            </label>
            <Button onClick={() => online?.onCreate(nickname)}>创建在线房间</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => online?.onJoin(code, nickname, "PLAYER")}>加入为玩家</Button>
              <Button variant="outline" onClick={() => online?.onJoin(code, nickname, "SPECTATOR")}>加入观战</Button>
            </div>
          </div>
        )}
        <dl className="grid gap-3">
          <Seat label="玩家 A" color="bg-team-a" />
          <Seat label="玩家 B" color="bg-team-b" />
        </dl>
        <p className="border-l-2 border-analysis pl-4 text-sm leading-6 text-muted-foreground">
          无真钱、奖品、兑换或转让价值。拍卖没有倒计时；每房最多 3 名只读观众。
        </p>
      </aside>
    </section>
  );
}

function Seat({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-3">
      <dt className="font-semibold">{label}</dt>
      <dd className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className={`size-2 rounded-full ${color}`} />20 块
      </dd>
    </div>
  );
}
