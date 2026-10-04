## Why

Players want to see how much is in the pool, and the owner's wife wants to type it in herself. The money is handled in cash at the bar, so the app must only show a number someone typed and never touch payment (v2 decision, `docs/v2/V2_PLAN.md`). Standings is where players look for it.

## What Changes

- A pool can have a **pool total**: one optional dollar amount, typed in by an admin.
- **Standings** (both pool types) shows it in a "Pool total" card with the line "Cash handled at the bar, not in this app." When no total is set, the card is not shown.
- **Pool settings** (admin) gets a "Pool total" field and a "Save pool total" button. It can be changed at any time, including after the pool's rules are locked, and cleared to hide the card.
- **Schema:** one new nullable column on `pools` (`pool_total_cents`). Additive only; nothing is rewritten and a revert needs no database rollback.
- Out of scope: any payment, payout, entry-fee or per-player money; the full Standings redesign (slice 7); the step-by-step admin screens (slice 9); an activity log entry for the change (slice 8).

## Capabilities

### New Capabilities
- `pool-total`: setting, clearing and showing a pool's display-only total, and the rule that the app never handles money.

### Modified Capabilities
<!-- None. -->

## Impact

- **Database:** migration adding `pools.pool_total_cents integer null`. **Schema-changing push:** the migration runs automatically in Railway's `preDeploy` once pushed, so it is called out before pushing.
- **Shared** (`packages/shared`): `updatePoolSchema` accepts `pool_total_cents` (whole number of cents, 0 to 100,000,000, or `null` to clear); small money helpers for formatting and parsing dollars.
- **API** (`apps/api`): `src/db/schema.ts`, `src/routes/pools.ts` (admin-only update, allowed in any pool status), tests.
- **Dashboard** (`apps/dashboard`): `PoolStandings.tsx` (card), `AdminDashboard.tsx` settings (field).
- **Tests:** API tests for permission, validation and clearing; `e2e/standings.spec.ts` and `e2e/admin-results.spec.ts` (or a new spec) updated for the card and the admin field.
- **Design:** `pot-options.html` (option B chosen), `standings.html`, `standings-pickem.html`, `admin-pool.html` in `docs/v2/mockups/`.
- **Risk:** low. The column is nullable with no default, so every existing pool simply shows no card.
