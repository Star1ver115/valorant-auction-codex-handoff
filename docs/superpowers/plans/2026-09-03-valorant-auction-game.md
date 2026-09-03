# VALORANT Peak Auction Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a responsive two-player professional-player auction game with read-only spectators, deterministic map/agent selection, and an explainable BO5 simulation.

**Architecture:** A Vinext/React Site renders one phase-driven game surface. A pure TypeScript domain package owns seeded randomness, auction rules, map BP, agent assignment, and BO5 simulation so same-device and online modes produce identical results. Online rooms use a Cloudflare-compatible API and D1-backed versioned event log; clients poll snapshots and submit optimistic-concurrency actions, while same-device mode persists the same event model in `localStorage`.

**Tech Stack:** TypeScript, React 19, Vinext, Tailwind CSS, Shadcn UI primitives, Node `node:test` with Vite SSR loading, Cloudflare Worker-compatible route handlers, D1, Sites hosting.

**Spec:** `docs/superpowers/specs/2026-09-03-valorant-auction-game-design.md`

## Global Constraints

- Two players start with exactly 20 units of non-purchasable, non-transferable virtual budget and finish with exactly five unique players each.
- Peak ratings must use a player's complete participation in one official event; a match, playoff round, map, agent, or filtered slice cannot independently define peak form.
- The ten-player pool and fourth-version ratings are fixed during implementation.
- Opening bids are arbitrary positive integers within balance; raises are arbitrary higher integers; passing ends that bidder's participation for the current card.
- No one-unit roster reserve exists. Zero-budget selection follows the exact “pay 1 to take / decline to give for 0” rule in the spec.
- Same-device and online play must call the same pure rules engine and be reproducible from the same seed and event log.
- Online rooms have two writable player seats, at most twenty read-only spectator seats, six-character room codes, reconnectable seat tokens, and 24-hour inactivity expiry.
- The seven-map pool, BP order, agent pools, simulation weights, score rules, and explanatory output match the spec exactly.
- The interface uses a VCT-broadcast information hierarchy with restrained cyan/coral/purple accents, no official logos, player photographs, team marks, or copied VALORANT client art.
- Mobile keeps the active card and action controls visible; all controls are keyboard reachable and have visible focus states.
- Do not add accounts, real currency, rewards, chat, voting, rankings, seasons, editable ratings, or social-preview artwork.

## File Structure

All product paths below are relative to the Site checkout at `site/` inside this workspace; design and plan documents remain at the workspace root.

```text
app/
  api/rooms/route.ts                 create room
  api/rooms/[code]/route.ts          read public snapshot
  api/rooms/[code]/join/route.ts     claim player/spectator seat
  api/rooms/[code]/actions/route.ts  submit versioned domain action
  globals.css                        theme tokens and responsive shell
  layout.tsx                         metadata, fonts, toaster
  page.tsx                           mode selection and game shell
components/game/
  AgentDraft.tsx                     per-map agent compositions
  AuctionStage.tsx                   bidding and zero-budget actions
  Bo5Broadcast.tsx                   map timeline and score presentation
  GameShell.tsx                      phase routing and shared chrome
  Lobby.tsx                          same-device/create/join flows
  MapBpStage.tsx                     seven-map veto/pick playback
  PostMatchReport.tsx                result and auction analysis
  RosterPanel.tsx                    budget and five-player roster
  SpectatorBadge.tsx                 read-only identity and count
hooks/
  useLocalGame.ts                    same-device event persistence
  useOnlineRoom.ts                   polling, reconnect, action submission
lib/game/
  agents.ts                          agents and proficiency data
  auction.ts                         auction transition function
  bp.ts                              deterministic seven-map BP
  engine.ts                          top-level reducer and invariants
  player-pool.ts                     fixed peak player dataset
  rng.ts                             seeded PRNG and constrained shuffle
  simulation.ts                      round/map/BO5 simulator
  types.ts                           domain types and action/event unions
  validation.ts                      runtime action validation
lib/server/
  auth.ts                            seat-token hashing and authorization
  rooms.ts                           D1 room/event repository
migrations/0001_rooms.sql            rooms, seats, events, indexes
tests/
  auction.test.mjs
  bp.test.mjs
  engine-properties.test.mjs
  fixtures.mjs
  online-room.test.mjs
  rng.test.mjs
  simulation.test.mjs
  ui-game-flow.test.mjs
.openai/hosting.json                 Site project and D1 declaration
```

---

### Task 1: Scaffold the Site and Lock the Domain Dataset

**Files:**
- Create: Site starter files, `lib/game/types.ts`, `lib/game/player-pool.ts`, `lib/game/agents.ts`, `tests/fixtures.mjs`, `tests/player-pool.test.mjs`
- Modify: `app/layout.tsx`, `app/globals.css`, `.openai/hosting.json`

**Interfaces:**
- Produces: `PlayerCard`, `PlayerId`, `Role`, `AgentId`, `MapId`, `PLAYER_POOL`, `MAP_POOL`, and `AGENT_PROFICIENCY`.
- Consumes: fourth-version values from the design spec.

- [ ] **Step 1: Initialize the standard Site starter and install its locked dependencies**

Create the empty checkout, then run the two commands below as separate operations with working directory `site/` for the Node commands:

```bash
mkdir -p /workspace/scratch/ca4b62253eba/site
node /root/.codex/plugins/cache/openai-curated-remote/sites/0.1.45/scripts/project-setup.mjs
node /root/.codex/plugins/cache/openai-curated-remote/sites/0.1.45/scripts/install-dependencies.mjs
```

Preserve the starter's `package.json`, `package-lock.json`, `vite.config.ts`, `sites()` plugin, and existing `npm test` contract (`npm run build && node --test tests/*.test.mjs`). Register one private Site immediately after setup and merge its returned `project_id` into `.openai/hosting.json` without changing the `DB` binding name.

- [ ] **Step 2: Write the failing dataset test**

```js
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";

const vite = await createServer({ appType: "custom", configFile: false, root: new URL("..", import.meta.url).pathname, resolve: { alias: { "@": new URL("..", import.meta.url).pathname } }, server: { middlewareMode: true } });
after(() => vite.close());

test("contains ten unique complete-event peak cards", async () => {
  const { PLAYER_POOL } = await vite.ssrLoadModule("/lib/game/player-pool.ts");
  assert.equal(PLAYER_POOL.length, 10);
  assert.equal(new Set(PLAYER_POOL.map((p) => p.id)).size, 10);
  assert.equal(PLAYER_POOL.every((p) => p.peak.sampleScope === "FULL_EVENT"), true);
  assert.equal(PLAYER_POOL.find((p) => p.id === "zmjjkk").tier, "T0.5");
  assert.equal(PLAYER_POOL.find((p) => p.id === "zmjjkk").referencePrice, 6);
  assert.equal(PLAYER_POOL.find((p) => p.id === "chichoo").referencePrice, 5);
});
```

- [ ] **Step 3: Run the focused test and confirm it fails because the dataset does not exist**

Run: `npm run build && node --test tests/player-pool.test.mjs`
Expected: FAIL on unresolved `@/lib/game/player-pool`.

- [ ] **Step 4: Implement domain types and all fixed records**

Define exact discriminated types:

```ts
export type Tier = "T0" | "T0.5" | "T1" | "T1.5";
export type Role = "DUELIST" | "INITIATOR" | "CONTROLLER" | "SENTINEL" | "FLEX";
export type PeakSample = { event: string; rounds: number; sampleScope: "FULL_EVENT"; evidence: string };
export type Attributes = { overall: number; aim: number; entry: number; utility: number; clutch: number; igl: number; adaptability: number };
export type PlayerCard = { id: string; name: string; region: "CN" | "EMEA" | "AMERICAS" | "PACIFIC"; primaryRole: Role; secondaryRoles: Role[]; tier: Tier; referencePrice: number; peak: PeakSample; attributes: Attributes; agents: string[] };
```

Populate the ten cards, seven maps, and per-player agent proficiency from sections 4 and 7 of the spec without adding or normalizing values.

- [ ] **Step 5: Apply the broadcast theme and neutral metadata**

Set title to `巅峰选手拍卖｜BO5 模拟器`, describe it as an unofficial fan strategy simulator, and define dark navy, cyan, coral, purple, off-white, border, focus-ring, and motion-duration tokens in `app/globals.css`.

- [ ] **Step 6: Run tests and build**

Run: `npm run build && node --test tests/player-pool.test.mjs`
Expected: one passing test file and successful production build.

- [ ] **Step 7: Commit**

```bash
git add site/app site/lib site/package.json site/package-lock.json site/tests site/.openai/hosting.json
git commit -m "feat: scaffold peak auction site and dataset"
```

### Task 2: Seeded Randomness and Constrained Auction Order

**Files:**
- Create: `lib/game/rng.ts`, `tests/rng.test.mjs`
- Modify: `lib/game/types.ts`

**Interfaces:**
- Produces: `createRng(seed: string): SeededRng`, `shuffleAuctionOrder(players, rng): PlayerId[]`.
- Consumes: `PlayerCard[]` and tier metadata.

- [ ] **Step 1: Write deterministic and constraint tests**

```js
test("repeats an order for the same seed and separates late premium cards", () => {
  const first = shuffleAuctionOrder(PLAYER_POOL, createRng("room-42"));
  const second = shuffleAuctionOrder(PLAYER_POOL, createRng("room-42"));
  assert.deepEqual(first, second);
  assert.equal(new Set(first).size, 10);
  const cards = first.map((id) => PLAYER_BY_ID[id]);
  assert.equal(cards.every((card, i) => i < 2 || !(card.tier === cards[i - 1].tier && card.tier === cards[i - 2].tier)), true);
  assert.ok(cards.slice(-2).filter((c) => c.tier === "T0" || c.tier === "T0.5").length < 2);
});
```

- [ ] **Step 2: Run the test and confirm missing exports**

Run: `npm run build && node --test tests/rng.test.mjs`
Expected: FAIL on `createRng` or `shuffleAuctionOrder`.

- [ ] **Step 3: Implement stable PRNG, Fisher–Yates retry, and deterministic backtracking fallback**

Use a UTF-8 string hash feeding a 32-bit PRNG. Try at most 100 shuffles, then recursively place unused cards whose tier does not create three consecutive equal tiers and whose placement leaves a valid final pair.

- [ ] **Step 4: Verify 1,000 seeds**

Extend the test to loop `seed-0` through `seed-999`, asserting uniqueness and both constraints for every order.

Run: `npm run build && node --test tests/rng.test.mjs`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add site/lib/game/rng.ts site/lib/game/types.ts site/tests/rng.test.mjs
git commit -m "feat: add deterministic constrained auction order"
```

### Task 3: Auction and Zero-Budget State Machine

**Files:**
- Create: `lib/game/auction.ts`, `lib/game/validation.ts`, `tests/auction.test.mjs`, `tests/engine-properties.test.mjs`
- Modify: `lib/game/types.ts`, `tests/fixtures.mjs`

**Interfaces:**
- Produces: `applyAuctionAction(state: AuctionState, action: AuctionAction): AuctionTransition`, `assertAuctionInvariants(state): void`.
- Consumes: ordered player IDs and seeded opener parity.

- [ ] **Step 1: Define failing examples for free opening bids and pass**

```js
test("accepts a non-unit opener and awards on pass", () => {
  let state = auctionFixture({ opener: "A" });
  state = applyAuctionAction(state, { type: "BID", actor: "A", amount: 7 }).state;
  state = applyAuctionAction(state, { type: "PASS", actor: "B" }).state;
  assert.equal(state.teams.A.budget, 13);
  assert.equal(state.teams.A.roster.length, 1);
});
```

- [ ] **Step 2: Define failing zero-budget examples**

```js
test("lets the solvent player pay one or give the card away for zero", () => {
  const take = applyAuctionAction(zeroBudgetFixture(), { type: "ZERO_CHOICE", actor: "B", choice: "TAKE" }).state;
  assert.equal(take.teams.B.budget, 4);
  const decline = applyAuctionAction(zeroBudgetFixture(), { type: "ZERO_CHOICE", actor: "B", choice: "DECLINE" }).state;
  assert.ok(decline.teams.A.roster.includes("chichoo"));
  assert.equal(decline.teams.A.budget, 0);
});
```

- [ ] **Step 3: Run tests and confirm failures**

Run: `npm run build && node --test tests/auction.test.mjs`
Expected: FAIL because transitions are not implemented.

- [ ] **Step 4: Implement legal transitions and domain errors**

Return `{ state, events }`; reject non-integers, over-budget bids, non-higher raises, repeat participation after pass, wrong actors, sixth-player awards, stale phase data, and any unsupported timeout action. Auction turns never advance without an explicit player bid, pass, or zero-budget choice.

- [ ] **Step 5: Add invariant/property loops**

Generate at least 2,000 deterministic legal action sequences and assert budgets never fall below zero, no player is duplicated, roster length never exceeds five, and every completed auction has two five-player rosters containing all ten IDs.

Run: `npm run build && node --test tests/auction.test.mjs tests/engine-properties.test.mjs`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add site/lib/game site/tests/auction.test.mjs site/tests/engine-properties.test.mjs site/tests/fixtures.mjs
git commit -m "feat: implement auction and zero-budget rules"
```

### Task 4: Deterministic Map BP and Agent Assignment

**Files:**
- Create: `lib/game/bp.ts`, `tests/bp.test.mjs`
- Modify: `lib/game/types.ts`, `lib/game/agents.ts`

**Interfaces:**
- Produces: `runMapBp(rosters, seed): MapBpResult`, `selectAgents(roster, map, seed): AgentComposition`.
- Consumes: completed five-player rosters and proficiency tables.

- [ ] **Step 1: Write failing BP sequence test**

```js
test("produces two bans, four picks, and one decider without duplicates", () => {
  const bp = runMapBp(completeRosters(), "bp-1");
  assert.deepEqual(bp.steps.map((s) => s.kind), ["BAN", "BAN", "PICK", "PICK", "PICK", "PICK", "DECIDER"]);
  assert.equal(new Set(bp.steps.map((s) => s.map)).size, 7);
  assert.equal(bp.steps.every((s) => s.reason.length > 10), true);
});
```

- [ ] **Step 2: Write failing composition test**

```js
test("assigns unique agents with controller and initiator coverage", () => {
  const comp = selectAgents(completeRosters().A, "HAVEN", "agents-1");
  assert.equal(new Set(comp.picks.map((p) => p.agent)).size, 5);
  assert.ok(comp.coverage.controller >= 1);
  assert.ok(comp.coverage.initiator >= 1);
});
```

- [ ] **Step 3: Run tests and confirm missing implementations**

Run: `npm run build && node --test tests/bp.test.mjs`
Expected: FAIL.

- [ ] **Step 4: Implement scoring and exhaustive assignment search**

Implement composition score `0.40P + 0.25M + 0.20R + 0.10S + 0.05F`, enumerate only each player's declared career agent pool, prune duplicate-agent branches, apply soft penalties for role gaps, and use the seed only for exact-score ties.

- [ ] **Step 5: Verify every map and representative roster split**

Test all seven maps with at least five roster partitions, asserting deterministic results, no duplicate agents, and a non-empty explanation per BP step and composition.

Run: `npm run build && node --test tests/bp.test.mjs`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add site/lib/game/bp.ts site/lib/game/agents.ts site/lib/game/types.ts site/tests/bp.test.mjs
git commit -m "feat: add automatic map bp and agent selection"
```

### Task 5: Round, Map, and BO5 Simulation

**Files:**
- Create: `lib/game/simulation.ts`, `tests/simulation.test.mjs`
- Modify: `lib/game/types.ts`

**Interfaces:**
- Produces: `simulateSeries(input: SeriesInput): SeriesResult` including maps, round events, player lines, MVPs, and explanations.
- Consumes: BP result, both agent compositions, peak attributes, and seed.

- [ ] **Step 1: Write failing series invariants**

```js
test("stops when one team reaches three map wins", () => {
  const result = simulateSeries(seriesFixture("series-7"));
  assert.equal(Math.max(result.score.A, result.score.B), 3);
  assert.ok(result.maps.filter((m) => m.status === "PLAYED").length >= 3);
  assert.ok(result.maps.filter((m) => m.status === "PLAYED").length <= 5);
  assert.equal(result.maps.every((m) => m.status !== "PLAYED" || (Math.max(m.score.A, m.score.B) >= 13 && Math.abs(m.score.A - m.score.B) >= 2)), true);
});
```

- [ ] **Step 2: Write weighting and reproducibility tests**

Assert identical seeds produce byte-equivalent results; stronger rosters win more often across 5,000 seeds; and the observed upset rate remains non-zero. Assert the strength ledger reports weights `40/20/14/10/4/12`.

- [ ] **Step 3: Run tests and confirm failure**

Run: `npm run build && node --test tests/simulation.test.mjs`
Expected: FAIL.

- [ ] **Step 4: Implement map strength and correlated form**

Calculate team-level and player-level form from separate seeded draws, convert strength difference through a bounded logistic probability of 18%–82%, and include pistol, anti-eco, rifle, eco, save, and clutch event categories.

- [ ] **Step 5: Implement economy, regulation, overtime, and statistics**

Track side, loss bonus, equipment class, round winner, highlights, K/D/A, ACS, first kills, clutches, map MVP, series MVP, best purchase, overpay, and two-to-three explanatory winning factors.

- [ ] **Step 6: Run focused and Monte Carlo tests**

Run: `npm run build && node --test tests/simulation.test.mjs`
Expected: all tests PASS with fixed-seed snapshots and no invariant failures across 5,000 simulations.

- [ ] **Step 7: Commit**

```bash
git add site/lib/game/simulation.ts site/lib/game/types.ts site/tests/simulation.test.mjs
git commit -m "feat: implement deterministic bo5 simulation"
```

### Task 6: Compose the Top-Level Engine

**Files:**
- Create: `lib/game/engine.ts`, `tests/engine.test.mjs`
- Modify: `lib/game/types.ts`, `tests/fixtures.mjs`

**Interfaces:**
- Produces: `createGame(seed, players): GameState`, `reduceGame(state, action): GameTransition`, `replayGame(seed, events): GameState`, `publicSnapshot(state): PublicGameSnapshot`.
- Consumes: Tasks 2–5 domain functions.

- [ ] **Step 1: Write a failing end-to-end domain replay test**

Create a fixed action sequence that fills both teams, then assert the reducer advances through `LOBBY → AUCTION → MAP_BP → AGENT_SELECT → MATCH_SIMULATION → SERIES_RESULT` and that replaying emitted events reconstructs the exact terminal snapshot.

- [ ] **Step 2: Run and confirm failure**

Run: `npm run build && node --test tests/engine.test.mjs`
Expected: FAIL on missing engine exports.

- [ ] **Step 3: Implement phase orchestration**

Keep the reducer pure: it receives state plus an explicit action and returns state plus domain events. Derive BP, compositions, and series results only from stored seed and completed roster state. Strip seat tokens and private authorization fields from `publicSnapshot`.

- [ ] **Step 4: Verify both normal and zero-budget full games**

Run: `npm run build && node --test tests/engine.test.mjs tests/engine-properties.test.mjs`
Expected: normal bidding and early-20-unit-spend fixtures both reach reproducible five-versus-five results.

- [ ] **Step 5: Commit**

```bash
git add site/lib/game/engine.ts site/lib/game/types.ts site/tests/engine.test.mjs site/tests/fixtures.mjs
git commit -m "feat: compose reproducible game engine"
```

### Task 7: Build the Same-Device Playable Vertical Slice

**Files:**
- Create: `hooks/useLocalGame.ts`, `components/game/GameShell.tsx`, `components/game/Lobby.tsx`, `components/game/AuctionStage.tsx`, `components/game/RosterPanel.tsx`, `tests/ui-game-flow.test.mjs`
- Modify: `app/page.tsx`, `app/globals.css`

**Interfaces:**
- Produces: `useLocalGame()` with `{ snapshot, dispatch, reset }`; auction UI covering lobby, bidding, pass, and zero-budget choices without a countdown.
- Consumes: `createGame`, `reduceGame`, and `publicSnapshot`.

- [ ] **Step 1: Write failing interaction tests**

Use Vite SSR loading plus `renderToStaticMarkup` to render lobby, active-auction, post-award, and zero-budget fixtures. Assert the 7-unit bid outcome appears with the updated roster/budget and that zero-budget fixture buttons read `支付 1 块要下` and `不要，0 块给对方`.

- [ ] **Step 2: Run UI tests and confirm failure**

Run: `npm run build && node --test tests/ui-game-flow.test.mjs`
Expected: FAIL because the game components do not exist.

- [ ] **Step 3: Implement local persistence and the recognizable auction screen**

Persist `{ schemaVersion, seed, events }` under `peak-auction:local:v1`; validate before hydration and discard corrupt records with a visible recovery notice. Build the first viewport around the current player card, both budgets, both compact rosters, turn indicator, bid input, pass button, and auction-order strip.

- [ ] **Step 4: Apply mobile and keyboard behavior**

Keep the current card/action dock sticky below 768px, move rosters into accessible sheets, autofocus only on desktop, label the numeric bid range, announce state changes with `aria-live`, and honor reduced-motion preferences.

- [ ] **Step 5: Run UI tests and production build**

Run: `npm run build && node --test tests/ui-game-flow.test.mjs`
Expected: tests PASS and production build succeeds.

- [ ] **Step 6: Verify the meaningful first slice without opening a browser**

Use the built Worker test to fetch `/` and assert HTTP 200, the product title, both team budget labels, the auction action region, and development preview metadata. This environment has no user-facing local preview, so do not start a development server or open a browser.

- [ ] **Step 7: Commit**

```bash
git add site/app site/components site/hooks site/tests/ui-game-flow.test.mjs
git commit -m "feat: add same-device auction experience"
```

### Task 8: Add Versioned Online Rooms and Read-Only Spectators

**Files:**
- Create: `migrations/0001_rooms.sql`, `lib/server/auth.ts`, `lib/server/rooms.ts`, API route files under `app/api/rooms`, `tests/online-room.test.mjs`
- Modify: `.openai/hosting.json`, `lib/game/validation.ts`

**Interfaces:**
- Produces: room create/join/read/action endpoints; repository functions `createRoom`, `joinRoom`, `readRoom`, `applyRoomAction`.
- Consumes: public snapshots and pure engine transitions.

- [ ] **Step 1: Create schema and failing repository tests**

Schema tables must include `rooms(code PRIMARY KEY, seed, version, state_json, created_at, last_active_at, spectators_open)`, `room_seats(room_code, role, token_hash, nickname, last_seen_at, PRIMARY KEY(room_code, role, token_hash))`, and `room_events(room_code, version, event_json, created_at, PRIMARY KEY(room_code, version))`, plus expiry and room-event indexes.

Test two player joins, spectator joins 1–20, rejection of spectator 21, spectator write rejection, stale-version rejection, duplicate action idempotency, and 24-hour expiry.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npm run build && node --test tests/online-room.test.mjs`
Expected: FAIL on missing repository.

- [ ] **Step 3: Implement token authorization and optimistic atomic updates**

Generate 32 random bytes for seat tokens, store only SHA-256 hashes, use constant-time comparison, accept actions only for the currently authorized player, and commit a room version update plus event insert as one D1 batch guarded by the expected version.

- [ ] **Step 4: Implement API contracts**

Use JSON shapes:

```ts
type CreateRoomResponse = { code: string; role: "A"; seatToken: string; snapshot: PublicGameSnapshot };
type JoinRoomRequest = { nickname: string; requestedRole: "PLAYER" | "SPECTATOR" };
type ActionRequest = { seatToken: string; expectedVersion: number; actionId: string; action: GameAction };
type SnapshotResponse = { version: number; snapshot: PublicGameSnapshot; events: DomainEvent[] };
```

Return 400 for invalid payloads, 401 for invalid tokens, 403 for spectator writes, 404 for unknown/expired rooms, 409 with current snapshot for stale versions, and 429 when spectator capacity is reached.

- [ ] **Step 5: Verify migrations, tests, and build**

Run `npm run db:generate`, inspect `migrations/0001_rooms.sql`, then run `npm run build && node --test tests/online-room.test.mjs`.
Expected: migration accepted, tests PASS, Worker-compatible production output builds.

- [ ] **Step 6: Commit**

```bash
git add site/migrations site/lib/server site/app/api site/tests/online-room.test.mjs site/.openai/hosting.json
git commit -m "feat: add online rooms and spectator authorization"
```

### Task 9: Connect Online Play, Reconnect, and Spectator UI

**Files:**
- Create: `hooks/useOnlineRoom.ts`, `components/game/SpectatorBadge.tsx`
- Modify: `components/game/Lobby.tsx`, `components/game/GameShell.tsx`, `components/game/AuctionStage.tsx`, `tests/ui-game-flow.test.mjs`

**Interfaces:**
- Produces: `useOnlineRoom(code, seatToken)` with `{ snapshot, connection, submit, reconnect }`.
- Consumes: Task 8 API contracts.

- [ ] **Step 1: Write failing online client tests**

Mock create/join/snapshot/action responses; verify room code display, token restoration, 409 snapshot replacement, spectator controls absent, late spectator snapshot hydration, and polling pause/resume on document visibility.

- [ ] **Step 2: Run and confirm failure**

Run: `npm run build && node --test tests/ui-game-flow.test.mjs`
Expected: new online tests FAIL.

- [ ] **Step 3: Implement resilient polling and action submission**

Poll every 750 ms while visible and every 4 seconds while hidden, retry network failures with capped exponential backoff, persist room code plus seat token in session storage, send a UUID action ID, and replace local state from any 409 response before allowing another action.

- [ ] **Step 4: Implement lobby and read-only states**

Add create room, join player, join spectator, copy room code, readiness, spectator count, close-new-spectators control for the host, connection indicator, and clear messages for full/expired rooms. Never render auction action controls for spectators.

- [ ] **Step 5: Verify tests and build**

Run: `npm run build && node --test tests/ui-game-flow.test.mjs tests/online-room.test.mjs`
Expected: all tests PASS and build succeeds.

- [ ] **Step 6: Commit**

```bash
git add site/hooks/useOnlineRoom.ts site/components/game site/tests/ui-game-flow.test.mjs
git commit -m "feat: connect online play and spectators"
```

### Task 10: Render BP, Agent Draft, BO5 Broadcast, and Report

**Files:**
- Create: `components/game/MapBpStage.tsx`, `components/game/AgentDraft.tsx`, `components/game/Bo5Broadcast.tsx`, `components/game/PostMatchReport.tsx`
- Modify: `components/game/GameShell.tsx`, `app/globals.css`, `tests/ui-game-flow.test.mjs`

**Interfaces:**
- Produces: complete post-auction phase presentation with skip/broadcast-speed controls that never alter the result.
- Consumes: public BP, composition, series, and report records from the engine.

- [ ] **Step 1: Write failing phase-render tests**

Assert seven BP steps and reasons, ten per-map agent picks, map score progression, “无需进行” on unplayed maps, map/series MVP labels, individual ACS/K/D/A/first-kill/clutch rows, best purchase, overpay, and two-to-three win factors.

- [ ] **Step 2: Run and confirm failure**

Run: `npm run build && node --test tests/ui-game-flow.test.mjs`
Expected: phase-render cases FAIL.

- [ ] **Step 3: Implement staged playback without recomputation**

Read only the already-generated public result. Playback speed changes timers; skip reveals the next completed stage; neither action creates a new seed nor reruns simulation. Present a horizontal series scoreboard on desktop and compact five-map rail on mobile.

- [ ] **Step 4: Implement report tables and explanatory hierarchy**

Use semantic tables for player statistics, progress bars for composition fit, cyan/coral team identity, purple for automated analysis, and concise text for BP reasons and win factors. Avoid decorative images; typography and data hierarchy carry the interface.

- [ ] **Step 5: Verify phase tests and build**

Run: `npm run build && node --test tests/ui-game-flow.test.mjs`
Expected: all tests PASS and build succeeds.

- [ ] **Step 6: Commit**

```bash
git add site/components/game site/app/globals.css site/tests/ui-game-flow.test.mjs
git commit -m "feat: add bp broadcast and post-match report"
```

### Task 11: Recovery, Accessibility, and Complete Product Validation

**Files:**
- Modify: `components/game/*.tsx`, `hooks/*.ts`, `app/globals.css`, `tests/*.test.mjs`

**Interfaces:**
- Produces: release candidate satisfying every acceptance criterion.
- Consumes: all prior tasks.

- [ ] **Step 1: Add failure-path tests**

Cover invalid/over-budget/non-integer bids, stale actions, refresh during auction and simulation, corrupt local state, disconnected-player reconnect without automatic state changes, spectator disconnect, full room, closed spectators, expired room, both budgets at zero, one roster filling early, and the final card.

- [ ] **Step 2: Run the complete suite and fix only observed failures**

Run: `npm test`
Expected: every unit, property, repository, and UI test PASS.

- [ ] **Step 3: Check accessibility and responsive behavior in automated DOM tests**

Assert one `h1`, labeled inputs, visible focus classes, no unlabeled icon buttons, live auction announcements, correct disabled states, and no horizontal document overflow at 360 px fixture width.

- [ ] **Step 4: Run release build through the Sites validator**

Run: `node /root/.codex/plugins/cache/openai-curated-remote/sites/0.1.45/scripts/build-site.mjs` with working directory `site/`.
Expected: successful build with the configured Worker/static outputs and no missing D1 declaration.

- [ ] **Step 5: Run a deterministic acceptance script**

Execute one same-device normal auction, one same-device early-zero auction, and one online game with two players plus a late spectator. For each, assert ten unique players, five per team, seven-map BP, unique per-map agents, first-to-three termination, explanations, and replay equality.

- [ ] **Step 6: Review the spec checklist**

Check sections 2–14 line by line. Record no acceptance item as satisfied unless its automated test or deterministic script output is available; add a focused regression test for any discovered gap.

- [ ] **Step 7: Commit**

```bash
git add site/app site/components site/hooks site/lib site/tests site/migrations site/.openai/hosting.json
git commit -m "test: validate complete peak auction experience"
```

### Task 12: Save, Deploy, and Handoff

**Files:**
- Modify only if validation exposes a release-blocking defect.

**Interfaces:**
- Produces: a private deployed Sites URL and retained source version.
- Consumes: validated release candidate and existing Site project ID.

- [ ] **Step 1: Re-run the full release gate**

Run: `npm test && npm run build`
Expected: zero failing tests and successful production build.

- [ ] **Step 2: Save a Site source version**

Use the existing Site project identity and write credential. Include the complete source tree, migration, and hosting configuration; exclude dependencies, build output, credentials, and test caches.

- [ ] **Step 3: Deploy the validated version privately**

Use the Sites hosting workflow, apply the D1 migration, deploy exactly the saved version, and verify terminal deployment status before handoff.

- [ ] **Step 4: Smoke-check the deployed root and room API**

Confirm the root returns the game shell, room creation returns a six-character code plus player-A seat, and public snapshot reading does not expose token hashes or private seat tokens.

- [ ] **Step 5: Deliver the URL and concise usage instructions**

Explain the three entry choices—same-device, create online room, join/observe—and state that all budgets are virtual with no purchases, prizes, or transferable value.
