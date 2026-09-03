"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { GameAction, PublicGameSnapshot, TeamId } from "@/lib/game/types";
import { AuctionStage } from "./AuctionStage";
import { Lobby } from "./Lobby";
import type { LobbyOnline } from "./Lobby";
import { RosterPanel } from "./RosterPanel";
import { SpectatorBadge } from "./SpectatorBadge";
import { MapBpStage } from "./MapBpStage";
import { AgentDraft } from "./AgentDraft";
import { Bo5Broadcast } from "./Bo5Broadcast";
import { PostMatchReport } from "./PostMatchReport";

export type OnlinePresentation = LobbyOnline & {
  onSpectatorsOpenChange?: (open: boolean) => void;
};

export function GameShell({
  snapshot,
  notice,
  onAction,
  onReset,
  online,
}: {
  snapshot: PublicGameSnapshot;
  notice: string | null;
  onAction: (action: GameAction) => void;
  onReset: () => void;
  online?: OnlinePresentation;
}) {
  if (snapshot.phase === "LOBBY") {
    return (
      <main className="min-h-screen">
        {notice ? <RecoveryNotice notice={notice} /> : null}
        <Lobby online={online} onStart={() => onAction({ type: "START_GAME" })} />
      </main>
    );
  }

  const auction = snapshot.auction;
  if (!auction) return null;

  if (snapshot.phase !== "AUCTION" && snapshot.phase !== "ZERO_BUDGET_SELECTION") {
    return <ResultsSequence snapshot={snapshot} notice={notice} online={online} onReset={onReset} />;
  }

  return (
    <main className="min-h-screen px-4 pb-24 pt-4 sm:px-6 lg:pb-8">
      <GameHeader online={online} onReset={onReset} />
      {notice ? <RecoveryNotice notice={notice} /> : null}
      <div className="mx-auto grid max-w-[1500px] gap-4 lg:grid-cols-[260px_minmax(0,1fr)_260px]">
        <div className="hidden lg:block">
          <Roster snapshot={snapshot} team="A" />
        </div>
        <AuctionStage
          snapshot={snapshot}
          onAction={onAction}
          readOnly={Boolean(
            online?.role === "SPECTATOR" ||
            (online?.role && online.role !== auction.bidding?.actor && online.role !== auction.zeroBudget?.actor),
          )}
        />
        <div className="hidden lg:block">
          <Roster snapshot={snapshot} team="B" />
        </div>
      </div>
      <div className="fixed inset-x-4 bottom-3 z-20 grid grid-cols-2 gap-2 lg:hidden">
        {(["A", "B"] as const).map((team) => (
          <Sheet key={team}>
            <SheetTrigger render={<Button variant="secondary" className="h-11 shadow-xl" />}>
              {snapshot.players[team].nickname} · {auction.teams[team].budget} 块
            </SheetTrigger>
            <SheetContent side={team === "A" ? "left" : "right"}>
              <SheetHeader>
                <SheetTitle>{snapshot.players[team].nickname}阵容</SheetTitle>
                <SheetDescription>当前预算和已拍得选手</SheetDescription>
              </SheetHeader>
              <div className="px-4"><Roster snapshot={snapshot} team={team} /></div>
            </SheetContent>
          </Sheet>
        ))}
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        当前阶段 {snapshot.phase}，已完成 {auction.lotIndex} 名选手。
      </p>
    </main>
  );
}

function ResultsSequence({ snapshot, notice, online, onReset }: {
  snapshot: PublicGameSnapshot;
  notice: string | null;
  online?: OnlinePresentation;
  onReset: () => void;
}) {
  const [visibleStage, setVisibleStage] = useState(1);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  useEffect(() => {
    if (visibleStage >= 4) return;
    const timer = setTimeout(() => setVisibleStage((stage) => Math.min(4, stage + 1)), 1800 / speed);
    return () => clearTimeout(timer);
  }, [speed, visibleStage]);

  return (
    <main className="min-h-screen px-4 pb-12 pt-4 sm:px-6">
      <GameHeader online={online} onReset={onReset} />
      {notice ? <RecoveryNotice notice={notice} /> : null}
      <div className="mx-auto mb-4 flex max-w-[1500px] flex-wrap items-center justify-between gap-2 border border-border bg-card/70 p-3">
        <p className="text-sm text-muted-foreground">自动播报 {visibleStage}/4 · 调速与跳过不会改变比赛结果</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setSpeed((value) => value === 1 ? 2 : value === 2 ? 4 : 1)}>{speed}× 速度</Button>
          <Button size="sm" onClick={() => setVisibleStage((stage) => Math.min(4, stage + 1))} disabled={visibleStage >= 4}>跳过当前阶段</Button>
        </div>
      </div>
      <div className="mx-auto grid max-w-[1500px] gap-4">
        <MapBpStage snapshot={snapshot} />
        {visibleStage >= 2 ? <AgentDraft snapshot={snapshot} /> : null}
        {visibleStage >= 3 ? <Bo5Broadcast snapshot={snapshot} /> : null}
        {visibleStage >= 4 ? <PostMatchReport snapshot={snapshot} /> : null}
      </div>
    </main>
  );
}

function GameHeader({ online, onReset }: { online?: OnlinePresentation; onReset: () => void }) {
  return (
    <header className="mx-auto mb-4 flex max-w-[1500px] items-center justify-between gap-3 border-b border-border py-3">
      <div>
        <p className="eyebrow">PEAK AUCTION · LIVE DESK</p>
        <h1 className="text-xl font-black tracking-tight">巅峰选手拍卖</h1>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {online?.code ? <span className="font-mono text-sm font-bold tracking-[.16em]">{online.code}</span> : null}
        {online?.role === "SPECTATOR" ? <SpectatorBadge count={online.spectatorCount} /> : null}
        {online?.role === "A" && online.onSpectatorsOpenChange ? (
          <Button variant="ghost" onClick={() => online.onSpectatorsOpenChange?.(!online.spectatorsOpen)}>
            {online.spectatorsOpen ? "关闭新观众" : "开放新观众"}
          </Button>
        ) : null}
        <Button onClick={online?.code ? online.onLeave : onReset} variant="ghost">
          {online?.code ? "退出房间" : "重新开始"}
        </Button>
      </div>
    </header>
  );
}

function Roster({ snapshot, team }: { snapshot: PublicGameSnapshot; team: TeamId }) {
  const auction = snapshot.auction!;
  return (
    <RosterPanel
      team={team}
      nickname={snapshot.players[team].nickname}
      budget={auction.teams[team].budget}
      roster={auction.teams[team].roster}
    />
  );
}

function RecoveryNotice({ notice }: { notice: string }) {
  return (
    <output className="mx-auto mb-3 block max-w-5xl border border-analysis/50 bg-analysis/10 px-4 py-3 text-sm">
      {notice}
    </output>
  );
}
