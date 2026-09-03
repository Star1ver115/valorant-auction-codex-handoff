# Project Instructions

## Source of truth

Before changing product code, read both files completely:

1. `docs/superpowers/specs/2026-09-03-valorant-auction-game-design.md`
2. `docs/superpowers/plans/2026-09-03-valorant-auction-game.md`

Implement the plan task by task. Treat the design spec as authoritative when a plan detail and product rule appear to conflict.

## Fixed product decisions

- This is an unofficial, non-monetized strategy simulator. All auction units are virtual and have no purchase, prize, exchange, or transfer value.
- Two players each start with 20 units and must finish with exactly five unique players.
- No one-unit reserve is required. Opening bids may be any affordable positive integer; later bids may jump by any amount.
- Preserve the documented zero-budget selection behavior exactly.
- Every professional player's rating uses at least one complete official event as its peak sample. A final, playoff round, map, agent, or filtered slice cannot independently define peak form.
- Keep the fourth-version ten-player pool, tiers, prices, attributes, roles, maps, and agent pools unchanged unless the user explicitly requests a revision.
- In particular, ZmjjKK remains T0.5 / 6 and CHICHOO remains T0.5 / 5.
- Support same-device play, two-seat online rooms, and up to twenty read-only spectators.
- Use the same deterministic domain engine for local and online modes.
- Preserve the approved broadcast-style visual direction and do not use official logos, team marks, player photographs, or copied VALORANT client artwork.

## Execution rules

- Product code belongs under `site/`.
- Follow the Sites build and hosting skills. Use the Vinext starter and its existing `node:test` workflow; do not replace the starter toolchain.
- Follow test-driven development and commit after every independently testable plan task.
- Do not start browser QA unless the user explicitly requests it.
- Do not expose room tokens, token hashes, credentials, or private authorization state in public snapshots or logs.
- Do not add accounts, chat, voting, rankings, seasons, payments, rewards, or editable player ratings.

## Current state

- Design and planning are complete.
- No Site has been initialized and no product code exists yet.
- Start at Task 1 of the implementation plan.
