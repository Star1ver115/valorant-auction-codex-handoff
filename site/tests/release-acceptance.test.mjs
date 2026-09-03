import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createTestVite } from "./fixtures.mjs";

const vite = await createTestVite();
after(() => vite.close());

const PLAYERS = { A: { nickname: "青队" }, B: { nickname: "珊瑚队" } };

function nextLegalAction(state, run) {
  if (state.phase === "ZERO_BUDGET_SELECTION") {
    const actor = state.auction.zeroBudget.actor;
    const canTake = state.auction.teams[actor].budget > 0;
    return {
      type: "ZERO_CHOICE",
      actor,
      choice: canTake && (state.auction.lotIndex + run) % 3 !== 0 ? "TAKE" : "DECLINE",
    };
  }

  const bidding = state.auction.bidding;
  if (bidding.currentBid !== null) return { type: "PASS", actor: bidding.actor };
  const spendAllOnOpeningLot = run % 10 === 0 && state.auction.lotIndex === 0;
  return {
    type: "BID",
    actor: bidding.actor,
    amount: spendAllOnOpeningLot ? state.auction.teams[bidding.actor].budget : 1,
  };
}

test("completes ten thousand legal auctions and BO5 series with replay equality", async () => {
  const { createGame, publicSnapshot, reduceGame, replayGame } = await vite.ssrLoadModule(
    "/lib/game/engine.ts",
  );
  let earlyZeroGames = 0;
  let upsetsOrCloseSeries = 0;

  for (let run = 0; run < 10_000; run += 1) {
    const seed = `release-acceptance-${run}`;
    let state = reduceGame(createGame(seed, PLAYERS), { type: "START_GAME" }).state;
    let actions = 0;

    while (state.phase === "AUCTION" || state.phase === "ZERO_BUDGET_SELECTION") {
      if (state.phase === "ZERO_BUDGET_SELECTION") earlyZeroGames += actions === 2 ? 1 : 0;
      state = reduceGame(state, nextLegalAction(state, run)).state;
      actions += 1;
      assert.ok(actions < 40, `game ${run} auction did not terminate`);
    }

    const roster = [...state.auction.teams.A.roster, ...state.auction.teams.B.roster];
    assert.equal(state.phase, "SERIES_RESULT");
    assert.equal(state.auction.teams.A.roster.length, 5);
    assert.equal(state.auction.teams.B.roster.length, 5);
    assert.equal(new Set(roster).size, 10);
    assert.ok(state.auction.teams.A.budget >= 0 && state.auction.teams.B.budget >= 0);
    assert.equal(state.bp.steps.length, 7);
    assert.equal(state.bp.playOrder.length, 5);

    for (const map of state.bp.playOrder) {
      for (const team of ["A", "B"]) {
        const composition = state.compositions[map][team];
        assert.equal(composition.picks.length, 5);
        assert.equal(new Set(composition.picks.map((pick) => pick.agent)).size, 5);
      }
    }

    assert.equal(Math.max(state.series.score.A, state.series.score.B), 3);
    assert.ok(state.series.winningFactors.length >= 2);
    if (Math.min(state.series.score.A, state.series.score.B) >= 1) upsetsOrCloseSeries += 1;
    assert.deepEqual(
      publicSnapshot(replayGame(seed, state.eventLog)),
      publicSnapshot(state),
    );
  }

  assert.ok(earlyZeroGames >= 1_000);
  assert.ok(upsetsOrCloseSeries > 0);
});

test("finishes an online game while a late spectator receives the same public result", async () => {
  const { publicSnapshot, replayGame } = await vite.ssrLoadModule("/lib/game/engine.ts");
  const { applyRoomAction, createRoom, joinRoom, readRoom, MemoryRoomStore } =
    await vite.ssrLoadModule("/lib/server/rooms.ts");
  const store = new MemoryRoomStore();
  const host = await createRoom(store, "青队", { now: 0, code: "LATE99", seed: "online-acceptance" });
  const guest = await joinRoom(store, "LATE99", "珊瑚队", "PLAYER", 1);
  const tokens = { A: host.seatToken, B: guest.seatToken };
  let room = await applyRoomAction(store, "LATE99", {
    seatToken: host.seatToken,
    expectedVersion: 0,
    actionId: "online-start",
    action: { type: "START_GAME" },
    now: 2,
  });
  let actionIndex = 0;
  let lateSpectator;

  while (room.snapshot.phase === "AUCTION" || room.snapshot.phase === "ZERO_BUDGET_SELECTION") {
    const auction = room.snapshot.auction;
    const actor = auction.bidding?.actor ?? auction.zeroBudget?.actor;
    const action = room.snapshot.phase === "ZERO_BUDGET_SELECTION"
      ? { type: "ZERO_CHOICE", actor, choice: "DECLINE" }
      : auction.bidding.currentBid === null
        ? { type: "BID", actor, amount: 1 }
        : { type: "PASS", actor };
    room = await applyRoomAction(store, "LATE99", {
      seatToken: tokens[actor],
      expectedVersion: room.version,
      actionId: `online-action-${actionIndex}`,
      action,
      now: 3 + actionIndex,
    });
    actionIndex += 1;
    if (actionIndex === 3) {
      lateSpectator = await joinRoom(store, "LATE99", "观众", "SPECTATOR", 20);
      assert.equal(lateSpectator.version, room.version);
      assert.deepEqual(lateSpectator.snapshot, room.snapshot);
    }
  }

  const finalRead = await readRoom(store, "LATE99", 100);
  assert.equal(finalRead.snapshot.phase, "SERIES_RESULT");
  assert.equal(finalRead.snapshot.auction.teams.A.roster.length, 5);
  assert.equal(finalRead.snapshot.auction.teams.B.roster.length, 5);
  assert.equal(finalRead.snapshot.bp.steps.length, 7);
  assert.equal(Math.max(finalRead.snapshot.series.score.A, finalRead.snapshot.series.score.B), 3);
  assert.ok(finalRead.snapshot.series.winningFactors.length >= 2);
  assert.deepEqual(
    publicSnapshot(replayGame(finalRead.snapshot.seed, finalRead.snapshot.eventLog)),
    finalRead.snapshot,
  );
  assert.ok(lateSpectator);
});
