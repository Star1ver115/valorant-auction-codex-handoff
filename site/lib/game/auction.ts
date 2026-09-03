import type {
  AuctionAction,
  AuctionEvent,
  AuctionPhase,
  AuctionState,
  AuctionTransition,
  BiddingState,
  PlayerId,
  TeamId,
} from "./types";
import { assertPositiveInteger, DomainError } from "./validation";

const MAX_ROSTER_SIZE = 5;
const STARTING_BUDGET = 20;

function otherTeam(team: TeamId): TeamId {
  return team === "A" ? "B" : "A";
}

function openerForIndex(index: number): TeamId {
  return index % 2 === 0 ? "A" : "B";
}

function createBidding(order: readonly PlayerId[], lotIndex: number): BiddingState {
  const opener = openerForIndex(lotIndex);
  return {
    playerId: order[lotIndex],
    opener,
    actor: opener,
    currentBid: null,
    highBidder: null,
    passed: [],
  };
}

function cloneState(state: AuctionState): AuctionState {
  return {
    ...state,
    order: [...state.order],
    teams: {
      A: { budget: state.teams.A.budget, roster: [...state.teams.A.roster] },
      B: { budget: state.teams.B.budget, roster: [...state.teams.B.roster] },
    },
    bidding: state.bidding
      ? { ...state.bidding, passed: [...state.bidding.passed] }
      : null,
    zeroBudget: state.zeroBudget ? { ...state.zeroBudget } : null,
  };
}

function changePhase(
  state: AuctionState,
  phase: AuctionPhase,
  events: AuctionEvent[],
) {
  if (state.phase !== phase) {
    state.phase = phase;
    events.push({ type: "AUCTION_PHASE_CHANGED", phase });
  }
}

function awardCurrent(
  state: AuctionState,
  team: TeamId,
  price: number,
  events: AuctionEvent[],
) {
  const playerId = state.order[state.lotIndex];
  const target = state.teams[team];

  if (!playerId) throw new DomainError("NO_ACTIVE_PLAYER", "No active auction player");
  if (target.roster.length >= MAX_ROSTER_SIZE) {
    throw new DomainError("ROSTER_FULL", "A full roster cannot receive a sixth player");
  }
  if (price > target.budget) {
    throw new DomainError("OVER_BUDGET", "Award price exceeds remaining budget");
  }

  target.budget -= price;
  target.roster.push(playerId);
  events.push({ type: "PLAYER_AWARDED", playerId, team, price });
  state.lotIndex += 1;
  state.bidding = null;
}

function completeWithRemaining(
  state: AuctionState,
  recipient: TeamId,
  events: AuctionEvent[],
) {
  while (state.lotIndex < state.order.length) {
    awardCurrent(state, recipient, 0, events);
  }
  state.zeroBudget = null;
  changePhase(state, "COMPLETE", events);
}

function allocateBothZero(state: AuctionState, events: AuctionEvent[]) {
  while (state.lotIndex < state.order.length) {
    const preferred = openerForIndex(state.lotIndex);
    const recipient =
      state.teams[preferred].roster.length < MAX_ROSTER_SIZE
        ? preferred
        : otherTeam(preferred);
    awardCurrent(state, recipient, 0, events);
  }
  state.zeroBudget = null;
  changePhase(state, "COMPLETE", events);
}

function settleAfterAward(state: AuctionState, events: AuctionEvent[]) {
  if (state.lotIndex >= state.order.length) {
    state.zeroBudget = null;
    changePhase(state, "COMPLETE", events);
    return;
  }

  if (state.teams.A.roster.length === MAX_ROSTER_SIZE) {
    completeWithRemaining(state, "B", events);
    return;
  }
  if (state.teams.B.roster.length === MAX_ROSTER_SIZE) {
    completeWithRemaining(state, "A", events);
    return;
  }

  if (state.teams.A.budget === 0 && state.teams.B.budget === 0) {
    allocateBothZero(state, events);
    return;
  }

  if (state.teams.A.budget === 0 || state.teams.B.budget === 0) {
    const zeroTeam: TeamId = state.teams.A.budget === 0 ? "A" : "B";
    const solventTeam = otherTeam(zeroTeam);
    state.bidding = null;
    state.zeroBudget = { zeroTeam, solventTeam, actor: solventTeam };
    changePhase(state, "ZERO_BUDGET_SELECTION", events);
    return;
  }

  state.zeroBudget = null;
  state.bidding = createBidding(state.order, state.lotIndex);
  changePhase(state, "AUCTION", events);
}

export function createAuctionState(order: readonly PlayerId[]): AuctionState {
  if (order.length !== 10 || new Set(order).size !== 10) {
    throw new DomainError("INVALID_ORDER", "Auction order must contain ten unique players");
  }

  return {
    phase: "AUCTION",
    order: [...order],
    lotIndex: 0,
    teams: {
      A: { budget: STARTING_BUDGET, roster: [] },
      B: { budget: STARTING_BUDGET, roster: [] },
    },
    bidding: createBidding(order, 0),
    zeroBudget: null,
  };
}

function assertExpectedPhase(state: AuctionState, action: AuctionAction) {
  if (action.expectedPhase && action.expectedPhase !== state.phase) {
    throw new DomainError("STALE_PHASE", "Stale auction phase data");
  }
}

function applyBid(
  state: AuctionState,
  action: Extract<AuctionAction, { type: "BID" }>,
  events: AuctionEvent[],
) {
  const bidding = state.bidding;
  if (!bidding) throw new DomainError("WRONG_PHASE", "Bids require the auction phase");
  if (bidding.actor !== action.actor) {
    throw new DomainError("WRONG_TURN", "It is not this actor's turn");
  }
  if (bidding.passed.includes(action.actor)) {
    throw new DomainError("ALREADY_PASSED", "A bidder cannot re-enter after passing");
  }

  assertPositiveInteger(action.amount, "Bid amount");
  if (action.amount > state.teams[action.actor].budget) {
    throw new DomainError("OVER_BUDGET", "Bid exceeds remaining budget");
  }
  if (bidding.currentBid !== null && action.amount <= bidding.currentBid) {
    throw new DomainError("BID_NOT_HIGHER", "Bid must be higher than the current bid");
  }

  bidding.currentBid = action.amount;
  bidding.highBidder = action.actor;
  bidding.actor = otherTeam(action.actor);
  events.push({
    type: "BID_PLACED",
    playerId: bidding.playerId,
    actor: action.actor,
    amount: action.amount,
  });
}

function applyPass(
  state: AuctionState,
  actor: TeamId,
  events: AuctionEvent[],
) {
  const bidding = state.bidding;
  if (!bidding) throw new DomainError("WRONG_PHASE", "Passing requires the auction phase");
  if (bidding.actor !== actor) {
    throw new DomainError("WRONG_TURN", "It is not this actor's turn");
  }
  if (bidding.currentBid === null || bidding.highBidder === null) {
    throw new DomainError("OPENING_PASS", "Opening bidder cannot pass before a valid bid");
  }
  if (bidding.passed.includes(actor)) {
    throw new DomainError("ALREADY_PASSED", "A bidder cannot pass twice");
  }

  bidding.passed.push(actor);
  events.push({ type: "BIDDER_PASSED", playerId: bidding.playerId, actor });
  awardCurrent(state, bidding.highBidder, bidding.currentBid, events);
  settleAfterAward(state, events);
}

function applyZeroChoice(
  state: AuctionState,
  action: Extract<AuctionAction, { type: "ZERO_CHOICE" }>,
  events: AuctionEvent[],
) {
  const zeroBudget = state.zeroBudget;
  if (!zeroBudget || state.phase !== "ZERO_BUDGET_SELECTION") {
    throw new DomainError("WRONG_PHASE", "Zero-budget choices require the zero-budget phase");
  }
  if (action.actor !== zeroBudget.actor) {
    throw new DomainError("WRONG_TURN", "It is not this actor's turn");
  }

  const playerId = state.order[state.lotIndex];
  events.push({
    type: "ZERO_BUDGET_CHOICE",
    playerId,
    actor: action.actor,
    choice: action.choice,
  });

  if (action.choice === "TAKE") {
    if (state.teams[zeroBudget.solventTeam].budget < 1) {
      throw new DomainError("OVER_BUDGET", "Taking a zero-budget card requires one budget unit");
    }
    awardCurrent(state, zeroBudget.solventTeam, 1, events);
  } else {
    awardCurrent(state, zeroBudget.zeroTeam, 0, events);
  }

  settleAfterAward(state, events);
}

export function applyAuctionAction(
  current: AuctionState,
  action: AuctionAction,
): AuctionTransition {
  assertExpectedPhase(current, action);
  if (current.phase === "COMPLETE") {
    throw new DomainError("AUCTION_COMPLETE", "The auction is already complete");
  }

  const state = cloneState(current);
  const events: AuctionEvent[] = [];

  if (state.phase === "ZERO_BUDGET_SELECTION") {
    if (action.type !== "ZERO_CHOICE") {
      throw new DomainError("WRONG_PHASE", "Only a zero-budget choice is legal now");
    }
    applyZeroChoice(state, action, events);
  } else if (action.type === "BID") {
    applyBid(state, action, events);
  } else if (action.type === "PASS") {
    applyPass(state, action.actor, events);
  } else if (action.type === "ZERO_CHOICE") {
    throw new DomainError("WRONG_PHASE", "Zero-budget choices are not legal during bidding");
  } else {
    throw new DomainError("UNSUPPORTED_ACTION", "Unsupported auction action");
  }

  assertAuctionInvariants(state);
  return { state, events };
}

export function assertAuctionInvariants(state: AuctionState): void {
  for (const team of ["A", "B"] as const) {
    const entry = state.teams[team];
    if (!Number.isInteger(entry.budget) || entry.budget < 0 || entry.budget > STARTING_BUDGET) {
      throw new DomainError("INVALID_BUDGET", `${team} budget is outside the legal range`);
    }
    if (entry.roster.length > MAX_ROSTER_SIZE) {
      throw new DomainError("ROSTER_FULL", `${team} roster contains more than five players`);
    }
  }

  const assigned = [...state.teams.A.roster, ...state.teams.B.roster];
  if (new Set(assigned).size !== assigned.length) {
    throw new DomainError("DUPLICATE_PLAYER", "A player appears more than once");
  }
  if (state.order.length !== 10 || new Set(state.order).size !== 10) {
    throw new DomainError("INVALID_ORDER", "Auction order must contain ten unique players");
  }
  if (assigned.length !== state.lotIndex) {
    throw new DomainError("INVALID_PROGRESS", "Assigned player count does not match the lot index");
  }
  const expectedAssigned = new Set(state.order.slice(0, state.lotIndex));
  if (assigned.some((playerId) => !expectedAssigned.has(playerId))) {
    throw new DomainError("INVALID_PROGRESS", "Roster contains a player not yet processed");
  }

  if (state.phase === "COMPLETE") {
    if (
      state.lotIndex !== state.order.length ||
      state.teams.A.roster.length !== MAX_ROSTER_SIZE ||
      state.teams.B.roster.length !== MAX_ROSTER_SIZE
    ) {
      throw new DomainError("INCOMPLETE_AUCTION", "Completed auction must contain two five-player teams");
    }
  } else if (state.phase === "AUCTION") {
    if (!state.bidding || state.bidding.playerId !== state.order[state.lotIndex]) {
      throw new DomainError("INVALID_BIDDING", "Auction phase requires the current bidding record");
    }
  } else if (!state.zeroBudget) {
    throw new DomainError("INVALID_ZERO_PHASE", "Zero-budget phase requires its acting team");
  }
}
