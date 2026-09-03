"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { GameAction, PublicGameSnapshot, TeamId } from "@/lib/game/types";
import { AuctionStage } from "./AuctionStage";
import { Lobby } from "./Lobby";
import { RosterPanel } from "./RosterPanel";

export function GameShell({
  snapshot,
  notice,
  onAction,
  onReset,
}: {
  snapshot: PublicGameSnapshot;
  notice: string | null;
  onAction: (action: GameAction) => void;
  onReset: () => void;
}) {
  if (snapshot.phase === "LOBBY") {
    return (
      <main className="min-h-screen">
        {notice ? <RecoveryNotice notice={notice} /> : null}
        <Lobby onStart={() => onAction({ type: "START_GAME" })} />
      </main>
    );
  }

  const auction = snapshot.auction;
  if (!auction) return null;

  return (
    <main className="min-h-screen px-4 pb-24 pt-4 sm:px-6 lg:pb-8">
      <header className="mx-auto mb-4 flex max-w-[1500px] items-center justify-between border-b border-border py-3">
        <div>
          <p className="eyebrow">PEAK AUCTION · LIVE DESK</p>
          <h1 className="text-xl font-black tracking-tight">巅峰选手拍卖</h1>
        </div>
        <Button onClick={onReset} variant="ghost">重新开始</Button>
      </header>
      {notice ? <RecoveryNotice notice={notice} /> : null}
      <div className="mx-auto grid max-w-[1500px] gap-4 lg:grid-cols-[260px_minmax(0,1fr)_260px]">
        <div className="hidden lg:block">
          <Roster snapshot={snapshot} team="A" />
        </div>
        <AuctionStage snapshot={snapshot} onAction={onAction} />
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
