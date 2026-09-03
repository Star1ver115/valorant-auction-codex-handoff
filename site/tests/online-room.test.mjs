import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createTestVite } from "./fixtures.mjs";

const vite = await createTestVite();
after(() => vite.close());

const HOUR = 60 * 60 * 1000;

async function loadRooms() {
  return vite.ssrLoadModule("/lib/server/rooms.ts");
}

test("creates two player seats and stores only token hashes", async () => {
  const { createRoom, joinRoom, MemoryRoomStore } = await loadRooms();
  const store = new MemoryRoomStore();
  const created = await createRoom(store, "房主", {
    now: 1000,
    code: "ABC123",
    seed: "room-seed",
  });
  const joined = await joinRoom(store, "ABC123", "客队", "PLAYER", 1100);

  assert.equal(created.role, "A");
  assert.equal(created.code, "ABC123");
  assert.equal(joined.role, "B");
  assert.equal(created.snapshot.players.A.nickname, "房主");
  assert.equal(joined.snapshot.players.B.nickname, "客队");
  assert.equal(created.seatToken.length >= 40, true);
  assert.equal(store.debugSeats("ABC123").some((seat) =>
    seat.tokenHash.includes(created.seatToken)), false);
});

test("allows exactly three read-only spectators", async () => {
  const { createRoom, joinRoom, MemoryRoomStore } = await loadRooms();
  const store = new MemoryRoomStore();
  await createRoom(store, "房主", { now: 0, code: "WATCH3", seed: "watch" });

  for (let index = 1; index <= 3; index += 1) {
    const joined = await joinRoom(store, "WATCH3", `观众${index}`, "SPECTATOR", index);
    assert.equal(joined.role, "SPECTATOR");
    assert.equal(joined.spectatorCount, index);
  }
  await assert.rejects(
    joinRoom(store, "WATCH3", "观众4", "SPECTATOR", 10),
    (error) => error.code === "SPECTATOR_CAPACITY" && error.status === 429,
  );
});

test("rejects spectator writes and stale versions with the current snapshot", async () => {
  const { applyRoomAction, createRoom, joinRoom, MemoryRoomStore } = await loadRooms();
  const store = new MemoryRoomStore();
  const host = await createRoom(store, "房主", {
    now: 0,
    code: "ACTION",
    seed: "action",
  });
  const spectator = await joinRoom(store, "ACTION", "观察者", "SPECTATOR", 1);

  await assert.rejects(
    applyRoomAction(store, "ACTION", {
      seatToken: "not-a-seat-token",
      expectedVersion: 0,
      actionId: "invalid-token",
      action: { type: "START_GAME" },
      now: 2,
    }),
    (error) => error.code === "INVALID_TOKEN" && error.status === 401,
  );

  await assert.rejects(
    applyRoomAction(store, "ACTION", {
      seatToken: spectator.seatToken,
      expectedVersion: 0,
      actionId: "spectator-action",
      action: { type: "START_GAME" },
      now: 2,
    }),
    (error) => error.code === "SPECTATOR_READ_ONLY" && error.status === 403,
  );

  const first = await applyRoomAction(store, "ACTION", {
    seatToken: host.seatToken,
    expectedVersion: 0,
    actionId: "start-once",
    action: { type: "START_GAME" },
    now: 3,
  });
  assert.equal(first.version, 1);

  await assert.rejects(
    applyRoomAction(store, "ACTION", {
      seatToken: host.seatToken,
      expectedVersion: 0,
      actionId: "stale-new-action",
      action: { type: "START_GAME" },
      now: 4,
    }),
    (error) =>
      error.code === "STALE_VERSION" &&
      error.status === 409 &&
      error.current.snapshot.phase === "AUCTION",
  );
});

test("deduplicates action IDs before stale-version rejection", async () => {
  const { applyRoomAction, createRoom, MemoryRoomStore } = await loadRooms();
  const store = new MemoryRoomStore();
  const host = await createRoom(store, "房主", {
    now: 0,
    code: "REPLAY",
    seed: "replay",
  });
  const request = {
    seatToken: host.seatToken,
    expectedVersion: 0,
    actionId: "same-id",
    action: { type: "START_GAME" },
    now: 1,
  };

  const first = await applyRoomAction(store, "REPLAY", request);
  const duplicate = await applyRoomAction(store, "REPLAY", request);
  assert.deepEqual(duplicate, first);
  assert.equal(store.debugEvents("REPLAY").length, 1);
});

test("expires inactive rooms after twenty-four hours", async () => {
  const { createRoom, readRoom, MemoryRoomStore } = await loadRooms();
  const store = new MemoryRoomStore();
  await createRoom(store, "房主", { now: 500, code: "OLDONE", seed: "old" });

  await assert.rejects(
    readRoom(store, "OLDONE", 500 + 24 * HOUR + 1),
    (error) => error.code === "ROOM_NOT_FOUND" && error.status === 404,
  );
});
