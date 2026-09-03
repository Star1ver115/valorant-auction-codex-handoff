"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PLAYER_BY_ID } from "@/lib/game/player-pool";
import type { GameAction, PublicGameSnapshot, TeamId } from "@/lib/game/types";

const ROLE_LABEL = {
  DUELIST: "决斗",
  INITIATOR: "先锋",
  CONTROLLER: "控场",
  SENTINEL: "哨位",
  FLEX: "全能",
} as const;

export function AuctionStage({
  snapshot,
  onAction,
  readOnly = false,
}: {
  snapshot: PublicGameSnapshot;
  onAction: (action: GameAction) => void;
  readOnly?: boolean;
}) {
  const auction = snapshot.auction;
  const [amount, setAmount] = useState(1);
  if (!auction) return null;

  const currentId = auction.order[auction.lotIndex];
  const current = currentId ? PLAYER_BY_ID[currentId] : null;
  const actor: TeamId | null = auction.bidding?.actor ?? auction.zeroBudget?.actor ?? null;
  const minimum = auction.bidding?.currentBid === null
    ? 1
    : (auction.bidding?.currentBid ?? 0) + 1;
  const maximum = actor ? auction.teams[actor].budget : 0;
  const ordered = auction.order.map((id) => id ? PLAYER_BY_ID[id] : null);

  if (!current || !actor) return null;

  return (
    <section aria-label={readOnly ? "拍卖直播区" : "拍卖操作区"} className="grid min-w-0 gap-4">
      <div className="broadcast-panel overflow-hidden">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-border bg-muted/40 px-4 py-3">
          <span className="eyebrow">LOT {String(auction.lotIndex + 1).padStart(2, "0")}</span>
          <div className="h-px bg-border" />
          <span className={actor === "A" ? "text-team-a" : "text-team-b"}>
            {snapshot.players[actor].nickname} 回合
          </span>
        </div>
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{current.region}</Badge>
            <span className="text-xs text-muted-foreground">参考 {current.referencePrice} 块</span>
          </div>
          <h2 className="mt-5 text-4xl font-black uppercase tracking-[-.05em] sm:text-6xl">{current.name}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {ROLE_LABEL[current.primaryRole]} · {current.peak.event} 完整赛事样本
          </p>
          <div className="mt-7 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {Object.entries(current.attributes).map(([key, value]) => (
              <div key={key} className="border-l border-border pl-2">
                <p className="text-[10px] uppercase text-muted-foreground">{key}</p>
                <p className="font-mono text-lg font-bold">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {readOnly ? (
        <div className="broadcast-panel border-analysis/50 bg-analysis/10 p-4 text-center text-sm text-muted-foreground">
          {snapshot.players[actor].nickname} 正在操作，当前席位仅可观看。
        </div>
      ) : <div className="action-dock broadcast-panel p-4 sm:p-5">
        {auction.phase === "ZERO_BUDGET_SELECTION" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              className="h-11"
              disabled={maximum < 1}
              onClick={() => onAction({ type: "ZERO_CHOICE", actor, choice: "TAKE" })}
            >
              支付 1 块要下
            </Button>
            <Button
              className="h-11"
              variant="outline"
              onClick={() => onAction({ type: "ZERO_CHOICE", actor, choice: "DECLINE" })}
            >
              不要，0 块给对方
            </Button>
          </div>
        ) : (
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
            <label className="grid gap-1.5 text-sm font-semibold" htmlFor="bid-amount">
              出价（{minimum}–{maximum} 块）
              <Input
                id="bid-amount"
                type="number"
                inputMode="numeric"
                min={minimum}
                max={maximum}
                value={amount}
                autoFocus={false}
                onChange={(event) => setAmount(Number(event.target.value))}
                className="h-11 font-mono text-lg"
              />
            </label>
            <Button
              className="h-11 px-6"
              disabled={!Number.isInteger(amount) || amount < minimum || amount > maximum}
              onClick={() => onAction({ type: "BID", actor, amount })}
            >
              确认出价
            </Button>
            <Button
              className="h-11 px-6"
              variant="outline"
              disabled={auction.bidding?.currentBid === null}
              onClick={() => onAction({ type: "PASS", actor })}
            >
              放弃跟价
            </Button>
          </div>
        )}
      </div>}

      <div aria-label="拍卖顺序" className="flex gap-1 overflow-x-auto pb-2">
        {ordered.map((player, index) => (
          <div
            key={player?.id ?? `hidden-${index}`}
            aria-current={index === auction.lotIndex ? "step" : undefined}
            className={`min-w-20 border px-2 py-2 text-center text-xs ${index === auction.lotIndex ? "border-team-a bg-team-a/10" : "border-border bg-card/60"} ${index < auction.lotIndex ? "opacity-45" : ""}`}
          >
            <span className="block font-mono text-[10px] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
            <span className="font-semibold">
              {index <= auction.lotIndex && player ? player.name : "待揭晓"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
