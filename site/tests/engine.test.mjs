import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createTestVite } from "./fixtures.mjs";

const vite = await createTestVite();
after(() => vite.close());

const PLAYERS = { A: { nickname: "青队" }, B: { nickname: "珊瑚队" } };

async function loadEngine() {
  return vite.ssrLoadModule("/lib/game/engine.ts");
}

function finishNormally(state, reduceGame) {
  let current = state;
  while (current.phase === "AUCTION" || current.phase === "ZERO_BUDGET_SELECTION") {
    if (current.phase === "ZERO_BUDGET_SELECTION") {
      current = reduceGame(current, {
        type: "ZERO_CHOICE",
        actor: current.auction.zeroBudget.actor,
        choice: "DECLINE",
      }).state;
      continue;
    }
    const bidding = current.auction.bidding;
    current = reduceGame(
      current,
      bidding.currentBid === null
        ? { type: "BID", actor: bidding.actor, amount: 1 }
        : { type: "PASS", actor: bidding.actor },
    ).state;
  }
  return current;
}

test("advances a normal game through every deterministic phase and replays it", async () => {
  const { createGame, publicSnapshot, reduceGame, replayGame } = await loadEngine();
  let state = createGame("engine-normal", PLAYERS);
  state = reduceGame(state, { type: "START_GAME" }).state;
  state = finishNormally(state, reduceGame);

  const phases = state.eventLog
    .filter((event) => event.type === "PHASE_ADVANCED")
    .map((event) => event.phase);
  assert.deepEqual(phases, [
    "AUCTION",
    "MAP_BP",
    "AGENT_SELECT",
    "MATCH_SIMULATION",
    "SERIES_RESULT",
  ]);
  assert.equal(state.phase, "SERIES_RESULT");
  assert.equal(state.auction.teams.A.roster.length, 5);
  assert.equal(state.auction.teams.B.roster.length, 5);
  assert.equal(state.bp.steps.length, 7);
  assert.equal(Math.max(state.series.score.A, state.series.score.B), 3);

  const replayed = replayGame("engine-normal", state.eventLog);
  assert.deepEqual(publicSnapshot(replayed), publicSnapshot(state));
});

test("finishes reproducibly after an opening twenty-unit purchase", async () => {
  const { createGame, publicSnapshot, reduceGame, replayGame } = await loadEngine();
  let state = reduceGame(createGame("engine-zero", PLAYERS), {
    type: "START_GAME",
  }).state;
  const opener = state.auction.bidding.actor;
  state = reduceGame(state, { type: "BID", actor: opener, amount: 20 }).state;
  state = reduceGame(state, {
    type: "PASS",
    actor: state.auction.bidding.actor,
  }).state;

  while (state.phase === "ZERO_BUDGET_SELECTION") {
    const solvent = state.auction.zeroBudget.actor;
    const take = state.auction.teams[solvent].roster.length < 4;
    state = reduceGame(state, {
      type: "ZERO_CHOICE",
      actor: solvent,
      choice: take ? "TAKE" : "DECLINE",
    }).state;
  }

  assert.equal(state.phase, "SERIES_RESULT");
  assert.equal(state.auction.teams.A.roster.length, 5);
  assert.equal(state.auction.teams.B.roster.length, 5);
  assert.deepEqual(
    publicSnapshot(replayGame("engine-zero", state.eventLog)),
    publicSnapshot(state),
  );
});

test("removes authorization material from public snapshots", async () => {
  const { createGame, publicSnapshot } = await loadEngine();
  const state = createGame("engine-private", PLAYERS);
  state.authorization = {
    seatTokens: { A: "secret-a", B: "secret-b" },
    tokenHashes: ["hash-a", "hash-b"],
  };

  const snapshot = publicSnapshot(state);
  assert.equal("authorization" in snapshot, false);
  assert.equal(JSON.stringify(snapshot).includes("secret-a"), false);
  assert.equal(JSON.stringify(snapshot).includes("hash-a"), false);
});

test("reveals only the current and completed auction cards in public snapshots", async () => {
  const { createGame, publicSnapshot, reduceGame } = await loadEngine();
  let state = reduceGame(createGame("engine-hidden-order", PLAYERS), {
    type: "START_GAME",
  }).state;
  const first = state.auction.order[0];
  const second = state.auction.order[1];
  const initial = publicSnapshot(state);

  assert.equal(initial.auction.order[0], first);
  assert.equal(initial.auction.order.slice(1).every((id) => id === null), true);
  assert.equal(JSON.stringify(initial).includes(second), false);

  state = reduceGame(state, {
    type: "BID",
    actor: state.auction.bidding.actor,
    amount: 1,
  }).state;
  state = reduceGame(state, {
    type: "PASS",
    actor: state.auction.bidding.actor,
  }).state;
  const afterAward = publicSnapshot(state);
  assert.deepEqual(afterAward.auction.order.slice(0, 2), [first, second]);
  assert.equal(afterAward.auction.order.slice(2).every((id) => id === null), true);
});
