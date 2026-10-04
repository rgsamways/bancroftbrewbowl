## 1. Database

- [ ] 1.1 Add nullable `poolTotalCents` (`pool_total_cents`, integer) to `pools` in `apps/api/src/db/schema.ts`, run `pnpm db:generate`, and verify the migration is a single ADD COLUMN and applies cleanly to the local database with `pnpm db:migrate`

## 2. Shared rules and wording

- [ ] 2.1 Add `packages/shared/src/pool-total.ts` (parse typed dollars to cents or a plain message using the exact copy in the spec, empty means clear, and format cents as "$320" or "$320.50") and export it; verify with unit tests for each scenario in the spec (cents, negative, not a number, too large, empty, whole dollars) and `pnpm test`
- [ ] 2.2 Extend `updatePoolSchema` with `pool_total_cents` (integer 0 to 100,000,000, or null); verify with a schema test that accepts null, 0 and the maximum and refuses negatives, decimals and larger values

## 3. API

- [ ] 3.1 In `PATCH /pools/:poolId` apply `pool_total_cents` (including `null` to clear) and verify with route tests: an admin can set, change and clear it; a player gets 403; signed out gets 401; an invalid value is refused and leaves the total unchanged; it can be changed on an active (locked) pool without changing its rules; `GET /pools/:poolId` returns it; a pool never given a total returns null

## 4. Dashboard

- [ ] 4.1 Add the "Pool total" card to `PoolStandings.tsx` for both pool types (amount and "Cash handled at the bar, not in this app.", hidden when there is no total); verify with a screenshot at 390 by 844 against `standings.html` and `standings-pickem.html`, and an e2e check for whole dollars, cents and no card
- [ ] 4.2 Add the "Pool total" form to the admin pool settings (own Save button, usable when the rest is locked, plain error messages, empty clears); verify with a screenshot against `admin-pool.html` and an e2e check that an admin sets it, a player then sees it on Standings, and clearing hides it

## 5. Verify and ship

- [ ] 5.1 Run `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:e2e`, `pnpm test` and `pnpm test:e2e` and verify all pass
- [ ] 5.2 Call out the schema change, push to `staging`, and verify on `api-staging` (its own database) that the migration applied and the total can be set through the API; record what was seen
- [ ] 5.3 Update `openspec/ROADMAP.md` and `docs/HANDOFF.md`, sync specs, archive the change, and promote `staging` to `main`; confirm the production migration and deploy succeeded
