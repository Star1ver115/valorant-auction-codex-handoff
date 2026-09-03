import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createTestVite } from "./fixtures.mjs";

const vite = await createTestVite();
after(() => vite.close());

const PLAYERS = { A: { nickname: "青队" }, B: { nickname: "珊瑚队" } };

async function load() {
  const engine = await vite.ssrLoadModule("/lib/game/engine.ts");
  const players = await vite.ssrLoadModule("/lib/game/player-pool.ts");
  const { GameShell } = await vite.ssrLoadModule("/components/game/GameShell.tsx");
  return { ...engine, ...players, GameShell };
}

function render(GameShell, snapshot, notice = null) {
  return renderToStaticMarkup(
    createElement(GameShell, {
      snapshot,
      notice,
      onAction() {},
      onReset() {},
    }),
  );
}

function renderOnline(GameShell, snapshot, online) {
  return renderToStaticMarkup(
    createElement(GameShell, {
      snapshot,
      notice: null,
      onAction() {},
      onReset() {},
      online,
    }),
  );
}

test("renders the local lobby with the product identity and both seats", async () => {
  const { createGame, GameShell } = await load();
  const html = render(GameShell, createGame("ui-lobby", PLAYERS));

  assert.match(html, /巅峰选手拍卖/);
  assert.match(html, /同机双人/);
  assert.match(html, /玩家 A/);
  assert.match(html, /玩家 B/);
});

test("renders an active auction without a countdown", async () => {
  const { createGame, GameShell, PLAYER_BY_ID, reduceGame } = await load();
  const state = reduceGame(createGame("ui-active", PLAYERS), {
    type: "START_GAME",
  }).state;
  const html = render(GameShell, state);
  const currentName = PLAYER_BY_ID[state.auction.order[0]].name;
  const futureName = PLAYER_BY_ID[state.auction.order[1]].name;

  assert.match(html, /拍卖操作区/);
  assert.match(html, /青队预算/);
  assert.match(html, /珊瑚队预算/);
  assert.match(html, /出价/);
  assert.match(html, new RegExp(currentName, "i"));
  assert.doesNotMatch(html, new RegExp(futureName, "i"));
  assert.match(html, /待揭晓/);
  assert.doesNotMatch(html, /倒计时|剩余时间|自动出价|自动放弃/);
});

test("shows a seven-unit award in roster and remaining budget", async () => {
  const { createGame, GameShell, PLAYER_BY_ID, reduceGame } = await load();
  let state = reduceGame(createGame("ui-award", PLAYERS), {
    type: "START_GAME",
  }).state;
  const player = PLAYER_BY_ID[state.auction.order[state.auction.lotIndex]];
  const buyer = state.auction.bidding.actor;
  state = reduceGame(state, { type: "BID", actor: buyer, amount: 7 }).state;
  state = reduceGame(state, {
    type: "PASS",
    actor: state.auction.bidding.actor,
  }).state;
  const html = render(GameShell, state);

  assert.match(html, new RegExp(player.name, "i"));
  assert.match(html, new RegExp(`${PLAYERS[buyer].nickname}预算[^<]*13 块`));
});

test("shows the exact zero-budget choices and recovery notice", async () => {
  const { createGame, GameShell, reduceGame } = await load();
  let state = reduceGame(createGame("ui-zero", PLAYERS), {
    type: "START_GAME",
  }).state;
  const opener = state.auction.bidding.actor;
  state = reduceGame(state, { type: "BID", actor: opener, amount: 20 }).state;
  state = reduceGame(state, {
    type: "PASS",
    actor: state.auction.bidding.actor,
  }).state;
  const html = render(GameShell, state, "本地记录损坏，已安全重开一局。");

  assert.match(html, /支付 1 块要下/);
  assert.match(html, /不要，0 块给对方/);
  assert.match(html, /本地记录损坏，已安全重开一局/);
});

test("restores valid local event records and rejects corrupt hydration", async () => {
  const { createGame, reduceGame } = await load();
  const { restoreLocalGame } = await vite.ssrLoadModule("/hooks/useLocalGame.ts");
  const state = reduceGame(createGame("ui-restore", PLAYERS), {
    type: "START_GAME",
  }).state;
  const restored = restoreLocalGame(JSON.stringify({
    schemaVersion: 1,
    seed: state.seed,
    events: state.eventLog,
  }));

  assert.deepEqual(restored, state);
  assert.throws(
    () => restoreLocalGame('{"schemaVersion":1,"seed":"x","events":[]}'),
    /Invalid local game record/,
  );
});

test("renders online lobby controls with the three-spectator limit", async () => {
  const { createGame, GameShell } = await load();
  const html = renderOnline(GameShell, createGame("ui-online-lobby", PLAYERS), {
    connection: "IDLE",
    code: null,
    role: null,
    spectatorCount: 0,
    spectatorsOpen: true,
    onCreate() {},
    onJoin() {},
    onLeave() {},
  });

  assert.match(html, /创建在线房间/);
  assert.match(html, /加入为玩家/);
  assert.match(html, /加入观战/);
  assert.match(html, /最多 3 名只读观众/);
});

test("shows room identity while keeping spectator auction controls absent", async () => {
  const { createGame, GameShell, PLAYER_BY_ID, reduceGame } = await load();
  const state = reduceGame(createGame("ui-spectator", PLAYERS), {
    type: "START_GAME",
  }).state;
  const currentName = PLAYER_BY_ID[state.auction.order[0]].name;
  const html = renderOnline(GameShell, state, {
    connection: "CONNECTED",
    code: "Q7M4KP",
    role: "SPECTATOR",
    spectatorCount: 2,
    spectatorsOpen: true,
    onCreate() {},
    onJoin() {},
    onLeave() {},
  });

  assert.match(html, /Q7M4KP/);
  assert.match(html, /只读观战/);
  assert.match(html, new RegExp(currentName, "i"));
  assert.doesNotMatch(html, /确认出价|放弃跟价|支付 1 块要下/);
});

test("restores online session data and uses visibility-aware polling", async () => {
  const { pollDelayForVisibility, restoreOnlineSession } = await vite.ssrLoadModule(
    "/hooks/useOnlineRoom.ts",
  );
  const storage = {
    getItem(key) {
      return key === "peak-auction:room:v1"
        ? '{"code":"abc123","seatToken":"secret","role":"B"}'
        : null;
    },
  };

  assert.deepEqual(restoreOnlineSession(storage), {
    code: "ABC123",
    seatToken: "secret",
    role: "B",
  });
  assert.equal(pollDelayForVisibility("visible"), 750);
  assert.equal(pollDelayForVisibility("hidden"), 4000);
});

test("returns the latest snapshot from a 409 action response", async () => {
  const { submitOnlineAction } = await vite.ssrLoadModule("/hooks/useOnlineRoom.ts");
  const current = {
    version: 8,
    snapshot: { phase: "AUCTION" },
    events: [],
    spectatorCount: 1,
    spectatorsOpen: true,
  };
  const result = await submitOnlineAction(
    async () => Response.json({ error: { code: "STALE_VERSION" }, current }, { status: 409 }),
    {
      code: "ABC123",
      seatToken: "seat",
      expectedVersion: 7,
      actionId: "action-1",
      action: { type: "START_GAME" },
    },
  );

  assert.equal(result.conflict, true);
  assert.deepEqual(result.response, current);
});
