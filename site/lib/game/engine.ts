import { applyAuctionAction, createAuctionState } from "./auction";
import { runMapBp, selectAgents } from "./bp";
import { PLAYER_POOL } from "./player-pool";
import { createRng, shuffleAuctionOrder } from "./rng";
import { simulateSeries } from "./simulation";
import type {
  AgentComposition,
  AuctionAction,
  AuctionEvent,
  DomainEvent,
  GameAction,
  GamePhase,
  GamePlayers,
  GameState,
  GameTransition,
  MapId,
  PublicGameSnapshot,
  PublicDomainEvent,
  TeamId,
} from "./types";
import { DomainError } from "./validation";

function copyPlayers(players: GamePlayers): GamePlayers {
  return {
    A: { nickname: players.A.nickname },
    B: { nickname: players.B.nickname },
  };
}

export function createGame(seed: string, players: GamePlayers): GameState {
  if (!seed.trim()) throw new DomainError("INVALID_SEED", "Game seed cannot be empty");
  if (!players.A.nickname.trim() || !players.B.nickname.trim()) {
    throw new DomainError("INVALID_NICKNAME", "Both player nicknames are required");
  }

  const safePlayers = copyPlayers(players);
  return {
    schemaVersion: 1,
    dataVersion: "v4",
    version: 0,
    seed,
    phase: "LOBBY",
    players: safePlayers,
    auction: null,
    purchases: [],
    bp: null,
    compositions: null,
    series: null,
    eventLog: [{ type: "GAME_CREATED", players: safePlayers }],
  };
}

function appendEvents(
  state: GameState,
  events: DomainEvent[],
): GameTransition {
  state.eventLog = [...state.eventLog, ...events];
  state.version += 1;
  return { state, events };
}

function phaseEvent(state: GameState, phase: GamePhase, events: DomainEvent[]) {
  state.phase = phase;
  events.push({ type: "PHASE_ADVANCED", phase });
}

function auctionEvents(events: readonly AuctionEvent[]): DomainEvent[] {
  return events.map((event) => ({ type: "AUCTION_EVENT", event }));
}

function buildDerivedResults(state: GameState, events: DomainEvent[]) {
  const auction = state.auction;
  if (!auction || auction.phase !== "COMPLETE") {
    throw new DomainError("INCOMPLETE_AUCTION", "Cannot simulate before auction completion");
  }

  const rosters = { A: auction.teams.A.roster, B: auction.teams.B.roster };
  phaseEvent(state, "MAP_BP", events);
  state.bp = runMapBp(rosters, `${state.seed}:bp`);
  events.push({ type: "MAP_BP_COMPLETED", result: state.bp });

  phaseEvent(state, "AGENT_SELECT", events);
  const compositions: Partial<
    Record<MapId, Record<TeamId, AgentComposition>>
  > = {};
  for (const map of state.bp.playOrder) {
    compositions[map] = {
      A: selectAgents(rosters.A, map, `${state.seed}:agents:A:${map}`),
      B: selectAgents(rosters.B, map, `${state.seed}:agents:B:${map}`),
    };
  }
  state.compositions = compositions;
  events.push({ type: "AGENT_SELECTION_COMPLETED", compositions });

  phaseEvent(state, "MATCH_SIMULATION", events);
  state.series = simulateSeries({
    seed: `${state.seed}:series`,
    rosters,
    bp: state.bp,
    compositions,
    purchases: state.purchases,
  });
  events.push({ type: "SERIES_SIMULATED", result: state.series });
  phaseEvent(state, "SERIES_RESULT", events);
}

function cloneGameState(current: GameState): GameState {
  return structuredClone(current);
}

export function reduceGame(current: GameState, action: GameAction): GameTransition {
  const state = cloneGameState(current);
  const events: DomainEvent[] = [];

  if (action.type === "START_GAME") {
    if (state.phase !== "LOBBY") {
      throw new DomainError("WRONG_PHASE", "The game can only start from the lobby");
    }
    const order = shuffleAuctionOrder(PLAYER_POOL, createRng(`${state.seed}:auction-order`));
    state.auction = createAuctionState(order);
    events.push({ type: "GAME_STARTED", order });
    phaseEvent(state, "AUCTION", events);
    return appendEvents(state, events);
  }

  if (
    state.phase !== "AUCTION" &&
    state.phase !== "ZERO_BUDGET_SELECTION"
  ) {
    throw new DomainError("WRONG_PHASE", "Auction actions are not legal in this game phase");
  }
  if (!state.auction) throw new DomainError("MISSING_AUCTION", "Auction state is missing");

  const transition = applyAuctionAction(state.auction, action as AuctionAction);
  state.auction = transition.state;
  events.push({ type: "ACTION_ACCEPTED", action: structuredClone(action) });
  events.push(...auctionEvents(transition.events));

  for (const event of transition.events) {
    if (event.type === "PLAYER_AWARDED") {
      state.purchases.push({
        playerId: event.playerId,
        team: event.team,
        price: event.price,
      });
    }
  }

  if (state.auction.phase === "ZERO_BUDGET_SELECTION") {
    if (state.phase !== "ZERO_BUDGET_SELECTION") {
      phaseEvent(state, "ZERO_BUDGET_SELECTION", events);
    }
  } else if (state.auction.phase === "COMPLETE") {
    buildDerivedResults(state, events);
  } else if (state.phase !== "AUCTION") {
    phaseEvent(state, "AUCTION", events);
  }

  return appendEvents(state, events);
}

export function replayGame(seed: string, events: readonly DomainEvent[]): GameState {
  const created = events.find(
    (event): event is Extract<DomainEvent, { type: "GAME_CREATED" }> =>
      event.type === "GAME_CREATED",
  );
  if (!created) throw new DomainError("MISSING_CREATE_EVENT", "Replay requires GAME_CREATED");

  let state = createGame(seed, created.players);
  for (const event of events) {
    if (event.type === "GAME_STARTED") {
      state = reduceGame(state, { type: "START_GAME" }).state;
    } else if (event.type === "ACTION_ACCEPTED") {
      state = reduceGame(state, event.action).state;
    }
  }
  return state;
}

export function publicSnapshot(state: GameState): PublicGameSnapshot {
  const { authorization: _authorization, ...safe } = state;
  const visibleOrder = publicAuctionOrder(state);
  return structuredClone({
    ...safe,
    auction: state.auction ? { ...state.auction, order: visibleOrder } : null,
    eventLog: publicEvents(state.eventLog, visibleOrder),
  });
}

export function publicEvents(
  events: readonly DomainEvent[],
  visibleOrder: Array<string | null>,
): PublicDomainEvent[] {
  return events.map((event) => event.type === "GAME_STARTED"
    ? { ...event, order: [...visibleOrder] }
    : structuredClone(event)) as PublicDomainEvent[];
}

function publicAuctionOrder(state: GameState) {
  if (!state.auction) return [];
  const revealThrough = state.auction.phase === "COMPLETE"
    ? state.auction.order.length - 1
    : state.auction.lotIndex;
  return state.auction.order.map((id, index) => index <= revealThrough ? id : null);
}
