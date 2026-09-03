import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createTestVite } from "./fixtures.mjs";

const vite = await createTestVite();
after(() => vite.close());

test("preserves auction invariants across two thousand legal action sequences", async () => {
  const { applyAuctionAction, assertAuctionInvariants, createAuctionState } =
    await vite.ssrLoadModule("/lib/game/auction.ts");
  const { PLAYER_POOL } = await vite.ssrLoadModule("/lib/game/player-pool.ts");
  const { createRng, shuffleAuctionOrder } = await vite.ssrLoadModule("/lib/game/rng.ts");

  for (let run = 0; run < 2_000; run += 1) {
    const rng = createRng(`auction-property-${run}`);
    const order = shuffleAuctionOrder(PLAYER_POOL, rng);
    let state = createAuctionState(order);
    let actions = 0;

    while (state.phase !== "COMPLETE") {
      assert.ok(actions < 200, `auction ${run} did not terminate`);
      let action;

      if (state.phase === "ZERO_BUDGET_SELECTION") {
        action = {
          type: "ZERO_CHOICE",
          actor: state.zeroBudget.actor,
          choice: rng.next() < 0.5 ? "TAKE" : "DECLINE",
        };
      } else {
        const { actor, currentBid } = state.bidding;
        const budget = state.teams[actor].budget;
        const canRaise = currentBid !== null && currentBid < budget;
        if (currentBid === null) {
          const spendAll = rng.next() < 0.08;
          action = {
            type: "BID",
            actor,
            amount: spendAll ? budget : 1 + rng.int(budget),
          };
        } else if (canRaise && rng.next() < 0.42) {
          action = {
            type: "BID",
            actor,
            amount: currentBid + 1 + rng.int(budget - currentBid),
          };
        } else {
          action = { type: "PASS", actor };
        }
      }

      state = applyAuctionAction(state, action).state;
      assertAuctionInvariants(state);
      actions += 1;
    }

    assert.equal(state.teams.A.roster.length, 5);
    assert.equal(state.teams.B.roster.length, 5);
    assert.equal(new Set([...state.teams.A.roster, ...state.teams.B.roster]).size, 10);
  }
});
