import assert from "node:assert/strict";
import test, { after } from "node:test";
import { completeRosters, createTestVite } from "./fixtures.mjs";

const vite = await createTestVite();
after(() => vite.close());

test("produces two bans, four picks, and one decider without duplicates", async () => {
  const { runMapBp } = await vite.ssrLoadModule("/lib/game/bp.ts");
  const bp = runMapBp(completeRosters(), "bp-1");

  assert.deepEqual(
    bp.steps.map((step) => step.kind),
    ["BAN", "BAN", "PICK", "PICK", "PICK", "PICK", "DECIDER"],
  );
  assert.equal(new Set(bp.steps.map((step) => step.map)).size, 7);
  assert.equal(bp.steps.every((step) => step.reason.length > 10), true);
});

test("assigns unique agents with controller and initiator coverage", async () => {
  const { selectAgents } = await vite.ssrLoadModule("/lib/game/bp.ts");
  const composition = selectAgents(completeRosters().A, "HAVEN", "agents-1");

  assert.equal(composition.picks.length, 5);
  assert.equal(new Set(composition.picks.map((pick) => pick.agent)).size, 5);
  assert.ok(composition.coverage.controller >= 1);
  assert.ok(composition.coverage.initiator >= 1);
  assert.ok(composition.score > 0);
  assert.ok(composition.explanation.length > 10);
});

test("keeps BP and compositions deterministic across every map and five roster splits", async () => {
  const { MAP_POOL } = await vite.ssrLoadModule("/lib/game/player-pool.ts");
  const { runMapBp, selectAgents } = await vite.ssrLoadModule("/lib/game/bp.ts");

  for (let split = 0; split < 5; split += 1) {
    const rosters = completeRosters(split);
    assert.deepEqual(runMapBp(rosters, `bp-${split}`), runMapBp(rosters, `bp-${split}`));

    for (const map of MAP_POOL) {
      for (const team of ["A", "B"]) {
        const first = selectAgents(rosters[team], map, `agents-${split}-${team}-${map}`);
        const second = selectAgents(rosters[team], map, `agents-${split}-${team}-${map}`);
        assert.deepEqual(first, second);
        assert.equal(first.picks.length, 5);
        assert.equal(new Set(first.picks.map((pick) => pick.agent)).size, 5);
        assert.ok(first.coverage.controller >= 1);
        assert.ok(first.coverage.initiator >= 1);
        assert.ok(first.explanation.length > 10);
      }
    }
  }
});
