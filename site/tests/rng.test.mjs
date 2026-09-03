import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createTestVite } from "./fixtures.mjs";

const vite = await createTestVite();
after(() => vite.close());

const { PLAYER_POOL } = await vite.ssrLoadModule("/lib/game/player-pool.ts");
const PLAYER_BY_ID = Object.fromEntries(PLAYER_POOL.map((player) => [player.id, player]));

function assertValidOrder(order) {
  assert.equal(order.length, 10);
  assert.equal(new Set(order).size, 10);
  const cards = order.map((id) => PLAYER_BY_ID[id]);
  assert.equal(
    cards.every(
      (card, index) =>
        index < 2 ||
        !(card.tier === cards[index - 1].tier && card.tier === cards[index - 2].tier),
    ),
    true,
  );
  assert.ok(
    cards.slice(-2).filter((card) => card.tier === "T0" || card.tier === "T0.5")
      .length < 2,
  );
}

test("repeats an order for the same seed and separates late premium cards", async () => {
  const { createRng, shuffleAuctionOrder } = await vite.ssrLoadModule(
    "/lib/game/rng.ts",
  );

  const first = shuffleAuctionOrder(PLAYER_POOL, createRng("room-42"));
  const second = shuffleAuctionOrder(PLAYER_POOL, createRng("room-42"));

  assert.deepEqual(first, second);
  assertValidOrder(first);
});

test("satisfies auction-order constraints across one thousand seeds", async () => {
  const { createRng, shuffleAuctionOrder } = await vite.ssrLoadModule(
    "/lib/game/rng.ts",
  );

  for (let index = 0; index < 1_000; index += 1) {
    assertValidOrder(shuffleAuctionOrder(PLAYER_POOL, createRng(`seed-${index}`)));
  }
});
