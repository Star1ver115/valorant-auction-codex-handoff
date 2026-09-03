import assert from "node:assert/strict";
import test, { after } from "node:test";
import {
  auctionFixture,
  createTestVite,
  PLAYER_IDS,
  zeroBudgetFixture,
} from "./fixtures.mjs";

const vite = await createTestVite();
after(() => vite.close());

test("accepts a non-unit opener and awards on pass", async () => {
  const { applyAuctionAction } = await vite.ssrLoadModule("/lib/game/auction.ts");
  const initial = auctionFixture({ opener: "A" });
  const bid = applyAuctionAction(initial, { type: "BID", actor: "A", amount: 7 });
  const awarded = applyAuctionAction(bid.state, { type: "PASS", actor: "B" });

  assert.equal(initial.bidding.currentBid, null);
  assert.equal(awarded.state.teams.A.budget, 13);
  assert.deepEqual(awarded.state.teams.A.roster, ["aspas"]);
  assert.equal(awarded.events.at(-1).type, "PLAYER_AWARDED");
});

test("accepts arbitrary higher raises", async () => {
  const { applyAuctionAction } = await vite.ssrLoadModule("/lib/game/auction.ts");
  let state = applyAuctionAction(auctionFixture(), {
    type: "BID",
    actor: "A",
    amount: 2,
  }).state;

  state = applyAuctionAction(state, { type: "BID", actor: "B", amount: 11 }).state;
  const result = applyAuctionAction(state, { type: "PASS", actor: "A" });

  assert.equal(result.state.teams.B.budget, 9);
  assert.deepEqual(result.state.teams.B.roster, ["aspas"]);
});

test("lets the solvent player pay one or give the card away for zero", async () => {
  const { applyAuctionAction } = await vite.ssrLoadModule("/lib/game/auction.ts");
  const take = applyAuctionAction(zeroBudgetFixture(), {
    type: "ZERO_CHOICE",
    actor: "B",
    choice: "TAKE",
  }).state;
  const decline = applyAuctionAction(zeroBudgetFixture(), {
    type: "ZERO_CHOICE",
    actor: "B",
    choice: "DECLINE",
  }).state;

  assert.equal(take.teams.B.budget, 4);
  assert.ok(take.teams.B.roster.includes("chichoo"));
  assert.ok(decline.teams.A.roster.includes("chichoo"));
  assert.equal(decline.teams.A.budget, 0);
});

test("rejects timeout actions without changing the auction", async () => {
  const { applyAuctionAction } = await vite.ssrLoadModule("/lib/game/auction.ts");
  const state = auctionFixture();

  assert.throws(
    () => applyAuctionAction(state, { type: "TIMEOUT", actor: "A" }),
    /unsupported/i,
  );
  assert.deepEqual(state, auctionFixture());
});

test("rejects illegal bids, wrong actors, opening passes, and stale phase actions", async () => {
  const { applyAuctionAction } = await vite.ssrLoadModule("/lib/game/auction.ts");
  const state = auctionFixture();

  assert.throws(
    () => applyAuctionAction(state, { type: "BID", actor: "B", amount: 1 }),
    /turn/i,
  );
  assert.throws(
    () => applyAuctionAction(state, { type: "BID", actor: "A", amount: 1.5 }),
    /integer/i,
  );
  assert.throws(
    () => applyAuctionAction(state, { type: "BID", actor: "A", amount: 21 }),
    /budget/i,
  );
  assert.throws(() => applyAuctionAction(state, { type: "PASS", actor: "A" }), /opening/i);
  assert.throws(
    () =>
      applyAuctionAction(state, {
        type: "BID",
        actor: "A",
        amount: 1,
        expectedPhase: "ZERO_BUDGET_SELECTION",
      }),
    /stale/i,
  );

  const afterBid = applyAuctionAction(state, {
    type: "BID",
    actor: "A",
    amount: 7,
  }).state;
  assert.throws(
    () => applyAuctionAction(afterBid, { type: "BID", actor: "B", amount: 7 }),
    /higher/i,
  );
});

test("uses alternating zero-cost ownership after both budgets reach zero", async () => {
  const { applyAuctionAction, assertAuctionInvariants } = await vite.ssrLoadModule(
    "/lib/game/auction.ts",
  );
  const state = zeroBudgetFixture();
  state.order = [...PLAYER_IDS];
  state.teams.A.roster = ["aspas", "chronicle"];
  state.teams.B.roster = ["zmjjkk", "leo"];
  state.teams.B.budget = 1;
  state.lotIndex = 4;

  const result = applyAuctionAction(state, {
    type: "ZERO_CHOICE",
    actor: "B",
    choice: "TAKE",
  }).state;

  assert.equal(result.phase, "COMPLETE");
  assert.equal(result.teams.A.roster.length, 5);
  assert.equal(result.teams.B.roster.length, 5);
  assert.equal(new Set([...result.teams.A.roster, ...result.teams.B.roster]).size, 10);
  assertAuctionInvariants(result);
});

test("gives all remaining cards to the other team after a roster fills", async () => {
  const { applyAuctionAction, assertAuctionInvariants } = await vite.ssrLoadModule(
    "/lib/game/auction.ts",
  );
  const state = {
    phase: "AUCTION",
    order: [...PLAYER_IDS],
    lotIndex: 7,
    teams: {
      A: { budget: 10, roster: PLAYER_IDS.slice(0, 4) },
      B: { budget: 10, roster: PLAYER_IDS.slice(4, 7) },
    },
    bidding: {
      playerId: PLAYER_IDS[7],
      opener: "B",
      actor: "B",
      currentBid: null,
      highBidder: null,
      passed: [],
    },
    zeroBudget: null,
  };
  let next = applyAuctionAction(state, { type: "BID", actor: "B", amount: 1 }).state;
  next = applyAuctionAction(next, { type: "BID", actor: "A", amount: 2 }).state;
  next = applyAuctionAction(next, { type: "PASS", actor: "B" }).state;

  assert.equal(next.phase, "COMPLETE");
  assert.deepEqual(next.teams.A.roster, [...PLAYER_IDS.slice(0, 4), PLAYER_IDS[7]]);
  assert.deepEqual(next.teams.B.roster, [...PLAYER_IDS.slice(4, 7), ...PLAYER_IDS.slice(8)]);
  assertAuctionInvariants(next);
});
