import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createTestVite } from "./fixtures.mjs";

const vite = await createTestVite();
after(() => vite.close());

test("registers read and action tools that use the real game reducer", async () => {
  const { createGame, publicSnapshot, reduceGame } = await vite.ssrLoadModule(
    "/lib/game/engine.ts",
  );
  const { registerGameWebMcp } = await vite.ssrLoadModule(
    "/hooks/useGameWebMcp.ts",
  );
  let state = createGame("webmcp-contract", {
    A: { nickname: "青队" },
    B: { nickname: "珊瑚队" },
  });
  const tools = new Map();
  const context = {
    registerTool(tool) {
      tools.set(tool.name, tool);
    },
  };

  const unregister = registerGameWebMcp(context, {
    readSnapshot: () => publicSnapshot(state),
    submitAction: async (action) => {
      state = reduceGame(state, action).state;
      return publicSnapshot(state);
    },
    canAct: true,
  });

  assert.deepEqual([...tools.keys()], [
    "read_peak_auction_state",
    "submit_peak_auction_action",
  ]);
  assert.equal(tools.get("read_peak_auction_state").annotations.readOnlyHint, true);
  assert.equal(tools.get("submit_peak_auction_action").annotations.readOnlyHint, false);
  assert.deepEqual(await tools.get("read_peak_auction_state").execute({}), {
    phase: "LOBBY",
    version: 0,
    teams: {
      A: { nickname: "青队", budget: null, roster: [] },
      B: { nickname: "珊瑚队", budget: null, roster: [] },
    },
    currentLot: null,
  });

  const started = await tools.get("submit_peak_auction_action").execute({ action: "START" });
  assert.equal(started.phase, "AUCTION");
  assert.equal(started.version, 1);
  assert.equal(typeof started.currentLot.player, "string");
  assert.equal(started.currentLot.index, 1);

  await assert.rejects(
    tools.get("submit_peak_auction_action").execute({ action: "BID" }),
    /amount is required/i,
  );
  unregister();
});

test("keeps the action tool unavailable to spectators", async () => {
  const { registerGameWebMcp } = await vite.ssrLoadModule(
    "/hooks/useGameWebMcp.ts",
  );
  const tools = new Map();
  registerGameWebMcp(
    { registerTool(tool) { tools.set(tool.name, tool); } },
    {
      readSnapshot: () => ({ phase: "LOBBY", version: 0, players: {}, auction: null }),
      submitAction() { throw new Error("must not be called"); },
      canAct: false,
    },
  );

  assert.deepEqual([...tools.keys()], ["read_peak_auction_state"]);
});
