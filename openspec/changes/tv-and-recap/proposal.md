## Why

The bar wants a standings screen it can put on the TV, and players want a short "how did my week go" card. Both are designed (`docs/v2/mockups/tv-standings.html`, `recap.html`) and need numbers the server does not produce yet: most picked per team after the lock, players out this week, and the biggest upset. This is slice 13b of the v2 build.

## What Changes

- New `GET /pools/:poolId/tv`: what the TV page shows (week status, alive count, alive names or the pick 'em top 10, most picked teams after the lock).
- New `GET /pools/:poolId/recap?week=N`: the weekly recap (players left, players out this week, most picked, biggest upset, the viewer's own result; pick 'em variant).
- A signed-in TV page at `/pool/:poolId/tv` (no header or tabs, 16:9, refreshes itself, QR to the site) and a recap page at `/pool/:poolId/recap`, with a Share button.
- A "Show on TV" link at the bottom of Standings and a "Week N recap" card on Home once a week is fully decided.
- "Biggest upset" has no odds data behind it, so it is defined as the winning team the smallest share of players picked.
- No schema change. Pick counts are computed on request and only after the week locks.

## Capabilities

### New Capabilities
- `tv-standings`: the signed-in TV page and its data.
- `weekly-recap`: the weekly recap data, page and Share button.

### Modified Capabilities
- `home`: a "Week N recap" card when a decided week has picks.
- `standings`: a "Show on TV" link.

## Impact

- API: new `routes/tv.ts`, `lib/recap.ts`, `lib/pick-counts.ts`; `GET /me/summary` gains `recapWeek`.
- Shared: new `tv.ts` and `recap.ts` types, `formatShare` helper.
- Dashboard: `TvLayout`, TV and recap pages, small edits to `Home.tsx`, `PoolStandings.tsx`, `App.tsx`.
- Tests: API tests, shared unit test, new `e2e/tv.spec.ts` and `e2e/recap.spec.ts`, updated Home and Standings specs.
- Privacy: only names and aggregates leave the server; no emails, no one else's picks, nothing about picks before the lock.
