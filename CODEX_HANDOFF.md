# Codex Handoff — VALORANT Peak Player Auction Game

## Pause point

The project is paused immediately before implementation. This is intentional: no Site checkout, hosting identity, dependencies, migrations, or application source have been created, so Codex can begin from a clean Task 1 without reconciling partial code.

## Read first

- Product specification: `docs/superpowers/specs/2026-09-03-valorant-auction-game-design.md`
- Implementation plan: `docs/superpowers/plans/2026-09-03-valorant-auction-game.md`
- Persistent instructions: `AGENTS.md`

The specification is revision 4. The implementation plan contains twelve testable tasks and is committed at `f53febc`.

## Product summary

Build a responsive Chinese-language web game in which two players each receive 20 virtual units and publicly auction ten fixed peak-form VALORANT professionals into two five-player teams. The system then performs seven-map BP, assigns agents per map, simulates an explainable first-to-three BO5, and generates a post-match report. Support same-device play, online room codes, reconnect, and up to twenty read-only spectators.

## Rules most likely to be implemented incorrectly

1. Opening bids are not fixed at 1. The opener may submit any positive integer up to the remaining balance.
2. There is no forced one-unit reserve for empty roster slots.
3. A bidder who passes cannot re-enter bidding for that player.
4. When one side reaches zero budget, the solvent side processes remaining cards in order: pay exactly 1 to take, or decline so the zero-budget side receives the card for 0.
5. If both sides reach zero, remaining cards follow the documented alternating zero-cost fallback; if one roster reaches five, every remaining card goes to the other roster for 0.
6. The final result must always contain all ten unique players split exactly five and five.
7. All player ratings represent complete-event peak samples, not current form, career averages, or a single historic match.
8. ZmjjKK's Seoul final is supporting evidence only; his current design value remains T0.5 / 6 based on a complete-event anchor. CHICHOO remains T0.5 / 5 using the complete 2025 Masters Bangkok event.
9. Match-day randomness operates inside peak-form capability; it must not simulate age or current-form decline.
10. Spectators are strictly read-only and can join mid-game, but may never bid, pause, advance phases, reroll, or edit room state.

## Technical direction already selected

- Checkout: `site/` under the current workspace.
- Frontend/runtime: React 19 + Vinext Sites starter.
- Styling: Tailwind and existing Shadcn primitives.
- Tests: starter-native `node:test` `.mjs` files with Vite SSR loading where TypeScript/React source access is required.
- Shared game logic: pure deterministic TypeScript functions driven only by state, action, and seed.
- Online state: Cloudflare-compatible route handlers, D1 snapshots plus versioned events, optimistic concurrency, and hashed seat tokens.
- Synchronization: bounded polling; no unplanned chat or realtime social features.
- Visuals: dark broadcast desk, cyan team A, coral team B, purple automated analysis, no discretionary raster imagery required.

## First action for Codex

Read the three files above, invoke the required execution and Sites skills, then execute Task 1 exactly. Create the empty `site/` checkout, apply the standard Vinext starter, retain its package manager and lockfile, register one private Site, lock the fixed player dataset with a failing test, implement it, run the focused test and production build, and commit before Task 2.

## Validation and delivery target

Do not call the project complete until:

- the full automated suite passes;
- at least 10,000 legal auction/BO5 simulations satisfy all invariants;
- normal bidding, early-zero spending, both-zero fallback, full-roster fallback, stale online actions, reconnect, and late spectator joins are covered;
- the production build succeeds through the Sites validator;
- the deployed private Site returns the game UI and room API without leaking authorization data.

## Repository note

This workspace uses alternate Git metadata because a normal `.git` directory could not be initialized. When continuing in this exact workspace, use:

```bash
GIT_DIR=/workspace/scratch/ca4b62253eba/git-meta
GIT_WORK_TREE=/workspace/scratch/ca4b62253eba
```

If Codex copies the project into a new normal repository, this workaround is unnecessary. Never include `git-meta/` in commits or deliverables.

## Suggested prompt

> Read `AGENTS.md`, the product specification, and the implementation plan completely. Continue from the documented pause point. Use the required execution, test-driven-development, Sites building, and Sites hosting skills. Start at Task 1, keep the fixed revision-4 player data unchanged, verify each task before committing, and stop only at a clean committed checkpoint or after publishing the validated private Site.
