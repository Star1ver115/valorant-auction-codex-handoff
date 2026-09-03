"use client";

import { useEffect, useRef } from "react";
import { PLAYER_BY_ID } from "@/lib/game/player-pool";
import type { GameAction, PublicGameSnapshot, TeamId } from "@/lib/game/types";

type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute(input: unknown): unknown;
};

export type GameWebMcpContext = {
  registerTool(tool: ToolDefinition, options?: { signal?: AbortSignal }): void | Promise<void>;
};

type SubmitResult = PublicGameSnapshot | void;

type RegistrationOptions = {
  readSnapshot: () => PublicGameSnapshot;
  submitAction: (action: GameAction) => SubmitResult | Promise<SubmitResult>;
  canAct: boolean;
};

function stateSummary(snapshot: PublicGameSnapshot) {
  const auction = snapshot.auction;
  const currentId = auction?.order[auction.lotIndex] ?? null;
  const actor = auction?.bidding?.actor ?? auction?.zeroBudget?.actor ?? null;
  const currentBid = auction?.bidding?.currentBid ?? null;
  const currentLot = auction && currentId && actor ? {
    index: auction.lotIndex + 1,
    player: PLAYER_BY_ID[currentId].name,
    actor,
    currentBid,
    minimumBid: auction.bidding ? (currentBid ?? 0) + 1 : null,
    maximumBid: auction.teams[actor].budget,
  } : null;
  return {
    phase: snapshot.phase,
    version: snapshot.version,
    teams: {
      A: summarizeTeam(snapshot, "A"),
      B: summarizeTeam(snapshot, "B"),
    },
    currentLot,
  };
}

function summarizeTeam(snapshot: PublicGameSnapshot, team: TeamId) {
  const auctionTeam = snapshot.auction?.teams[team];
  return {
    nickname: snapshot.players[team].nickname,
    budget: auctionTeam?.budget ?? null,
    roster: auctionTeam?.roster.map((id) => PLAYER_BY_ID[id].name) ?? [],
  };
}

function actionFromInput(input: unknown, snapshot: PublicGameSnapshot): GameAction {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("input must be an object");
  }
  const value = input as Record<string, unknown>;
  if (value.action === "START") {
    if (snapshot.phase !== "LOBBY") throw new Error("START is only valid in the lobby");
    return { type: "START_GAME" };
  }
  const actor = snapshot.auction?.bidding?.actor ?? snapshot.auction?.zeroBudget?.actor;
  if (!actor) throw new Error("there is no active auction action");
  if (value.action === "BID") {
    if (typeof value.amount !== "number" || !Number.isInteger(value.amount)) {
      throw new Error("amount is required and must be an integer");
    }
    return { type: "BID", actor, amount: value.amount };
  }
  if (value.action === "PASS") return { type: "PASS", actor };
  if (value.action === "TAKE") return { type: "ZERO_CHOICE", actor, choice: "TAKE" };
  if (value.action === "DECLINE") return { type: "ZERO_CHOICE", actor, choice: "DECLINE" };
  throw new Error("action must be START, BID, PASS, TAKE, or DECLINE");
}

export function registerGameWebMcp(
  context: GameWebMcpContext,
  options: RegistrationOptions,
) {
  const lifecycle = new AbortController();
  const registration = { signal: lifecycle.signal };
  const reportRegistrationError = () => undefined;

  void Promise.resolve(context.registerTool({
    name: "read_peak_auction_state",
    title: "读取巅峰拍卖局面",
    description: "读取当前公开阶段、双方预算和阵容，以及当前已揭晓选手。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute: () => stateSummary(options.readSnapshot()),
  }, registration)).catch(reportRegistrationError);

  if (options.canAct) {
    void Promise.resolve(context.registerTool({
      name: "submit_peak_auction_action",
      title: "提交巅峰拍卖操作",
      description: "使用当前可操作席位开始游戏、报价、放弃跟价或完成零预算选择。该操作会推进公开局面。",
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["START", "BID", "PASS", "TAKE", "DECLINE"] },
          amount: { type: "integer", minimum: 1 },
        },
        required: ["action"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const before = options.readSnapshot();
        const result = await options.submitAction(actionFromInput(input, before));
        return stateSummary(result ?? options.readSnapshot());
      },
    }, registration)).catch(reportRegistrationError);
  }

  return () => lifecycle.abort();
}

export function useGameWebMcp(options: RegistrationOptions) {
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    const context = typeof document === "undefined"
      ? undefined
      : (document as Document & { modelContext?: GameWebMcpContext }).modelContext;
    if (!context?.registerTool) return;
    return registerGameWebMcp(context, {
      readSnapshot: () => optionsRef.current.readSnapshot(),
      submitAction: (action) => optionsRef.current.submitAction(action),
      canAct: options.canAct,
    });
  }, [options.canAct]);
}
