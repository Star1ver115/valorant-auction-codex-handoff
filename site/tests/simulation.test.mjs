import assert from "node:assert/strict";
import test, { after } from "node:test";
import { completeRosters, createTestVite } from "./fixtures.mjs";

const vite = await createTestVite();
after(() => vite.close());

const { runMapBp, selectAgents } = await vite.ssrLoadModule("/lib/game/bp.ts");

function seriesFixture(seed, rosters = completeRosters()) {
  const bp = runMapBp(rosters, "series-bp");
  const compositions = Object.fromEntries(
    bp.playOrder.map((map) => [
      map,
      {
        A: selectAgents(rosters.A, map, `composition-A-${map}`),
        B: selectAgents(rosters.B, map, `composition-B-${map}`),
      },
    ]),
  );

  return {
    seed,
    rosters,
    bp,
    compositions,
    purchases: [
      { playerId: "aspas", team: "A", price: 9 },
      { playerId: "chronicle", team: "A", price: 6 },
      { playerId: "zmjjkk", team: "A", price: 3 },
      { playerId: "leo", team: "A", price: 2 },
      { playerId: "less", team: "A", price: 0 },
      { playerId: "mako", team: "B", price: 5 },
      { playerId: "forsaken", team: "B", price: 6 },
      { playerId: "nobody", team: "B", price: 4 },
      { playerId: "chichoo", team: "B", price: 4 },
      { playerId: "boaster", team: "B", price: 1 },
    ],
  };
}

test("stops when one team reaches three map wins", async () => {
  const { simulateSeries } = await vite.ssrLoadModule("/lib/game/simulation.ts");
  const result = simulateSeries(seriesFixture("series-7"));
  const played = result.maps.filter((map) => map.status === "PLAYED");

  assert.equal(Math.max(result.score.A, result.score.B), 3);
  assert.ok(played.length >= 3);
  assert.ok(played.length <= 5);
  assert.equal(
    played.every(
      (map) => Math.max(map.score.A, map.score.B) >= 13 && Math.abs(map.score.A - map.score.B) >= 2,
    ),
    true,
  );
  assert.equal(
    result.maps.slice(played.length).every((map) => map.status === "NOT_NEEDED"),
    true,
  );
});

test("replays byte-equivalent results and exposes the approved strength weights", async () => {
  const { simulateSeries } = await vite.ssrLoadModule("/lib/game/simulation.ts");
  const input = seriesFixture("repeatable-series");
  const first = simulateSeries(input);
  const second = simulateSeries(input);

  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(first.strengthLedger.weights, {
    individual: 40,
    composition: 20,
    map: 14,
    leadership: 10,
    synergy: 4,
    form: 12,
  });
  assert.ok(first.seriesMvp.playerId);
  assert.ok(first.bestPurchase.playerId);
  assert.ok(first.overpay.playerId);
  assert.ok(first.winningFactors.length >= 2 && first.winningFactors.length <= 3);
});

test("emits explainable round categories and complete player lines", async () => {
  const { simulateSeries } = await vite.ssrLoadModule("/lib/game/simulation.ts");
  const categories = new Set();

  for (let index = 0; index < 80; index += 1) {
    const result = simulateSeries(seriesFixture(`category-${index}`));
    for (const map of result.maps.filter((entry) => entry.status === "PLAYED")) {
      for (const round of map.rounds) categories.add(round.category);
      assert.equal(map.playerLines.length, 10);
      assert.ok(map.highlights.length >= 3 && map.highlights.length <= 5);
      assert.ok(map.mvp.playerId);
      assert.ok(map.winningFactors.length >= 2 && map.winningFactors.length <= 3);
      assert.equal(
        map.playerLines.every(
          (line) =>
            Number.isFinite(line.acs) &&
            line.kills >= 0 &&
            line.deaths >= 0 &&
            line.assists >= 0 &&
            line.firstKills >= 0 &&
            line.clutches >= 0,
        ),
        true,
      );
    }
  }

  assert.deepEqual(
    [...categories].sort(),
    ["ANTI_ECO", "CLUTCH", "ECO", "PISTOL", "RIFLE", "SAVE"],
  );
});

test("favors the stronger roster across five thousand seeds while retaining upsets", async () => {
  const { simulateSeries } = await vite.ssrLoadModule("/lib/game/simulation.ts");
  const base = seriesFixture("balance-seed");
  let strongerWins = 0;

  for (let index = 0; index < 5_000; index += 1) {
    const result = simulateSeries({ ...base, seed: `balance-${index}` });
    if (result.winner === "A") strongerWins += 1;
  }

  assert.ok(strongerWins > 2_650, `stronger roster won only ${strongerWins} series`);
  assert.ok(strongerWins < 4_900, "upset rate collapsed to nearly zero");
});
