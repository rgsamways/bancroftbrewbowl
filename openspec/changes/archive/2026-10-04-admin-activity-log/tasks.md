## 1. Database

- [x] 1.1 Add the `admin_activity` table to `apps/api/src/db/schema.ts` (columns and keys as in design.md), run `pnpm db:generate`, and verify the migration is a single CREATE TABLE with its index and two foreign keys and applies cleanly to the local database with `pnpm db:migrate`

## 2. Shared

- [x] 2.1 Add the activity kinds (title and category for each) and the response type to `@bbb/shared`, and an Eastern "Today · 5:04 PM" / "Yesterday · 6:40 PM" / "Mon · 9:15 AM" formatter; verify with unit tests for every kind having a title and category and for the time formats across a day boundary

## 3. API: recording

- [x] 3.1 Add `apps/api/src/lib/activity.ts` with `recordActivity` (explicit actor from the session, runs in the caller's transaction when given one) and the before/after snapshot of the acting admin's own entries; verify with tests that a record stores the actor id and name, kind, sentence, pool and flag, and that a deleted pool or account leaves the record in place
- [x] 3.2 Record results and scores in `nfl.ts` (entered vs changed, game and result in the sentence, own-entry flag from the snapshot); verify with route tests for entered, changed, score and a result that eliminates the acting admin's own entry
- [x] 3.3 Record wipeout resolution in `wipeouts.ts`, inside its transaction, and player status changes and added players in `entries.ts`; verify with tests including own-entry flags for editing one's own status, adding oneself and keeping oneself alive, and no flag for someone else
- [x] 3.4 Record pool create, lock, unlock, settings, total and delete in `pools.ts`; verify with tests for each, that changing only the total says so, and that a refused request (player, invalid body, unknown pool) writes nothing
- [x] 3.5 Record announcements (`promotions.ts`) and automatic offers (`canned-promotions.ts`); verify with tests for create, edit, delete and toggle

## 4. API: reading and safety

- [x] 4.1 Add `GET /admin/activity` (admin only, newest first, 50 per page with a `before` cursor, filters Everything, Standings, Your own entry, Menu); verify with tests for player 403, signed out 401, ordering, paging across 50, each filter, and that "Your own entry" only shows the viewing admin's flagged records
- [x] 4.2 Prove the record cannot be changed (PATCH and DELETE on a record are not found, no code path updates or deletes `admin_activity`) and add the coverage test that every admin write route writes a record; verify both pass and that the coverage test fails when a route is left out

## 5. Dashboard

- [x] 5.1 Add `ActivityPage.tsx` at `/admin/activity` with the title, subtitle, filters, entries with day and time, title, sentence and own-entry mark, "Show earlier", the closing note, and a link in the interim admin sub-navigation; players are sent away; verify with a screenshot at 390 by 844 against `admin-activity.html` and a browser check that an admin's result entry appears and a player cannot reach the page

## 6. Verify and ship

- [x] 6.1 Add `e2e/admin-activity.spec.ts` (enter a result, see it, filter, player blocked) and update any spec affected by the admin sub-navigation change; verify `pnpm test:e2e` passes
- [x] 6.2 Run `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:e2e`, `pnpm test` and `pnpm test:e2e` and verify all pass
- [x] 6.3 Call out the schema change, push to `staging`, and verify on `api-staging` (its own database) that the table exists and an admin write creates a row; record what was seen (Table and columns confirmed on staging's own database, and `GET /admin/activity` answers 401 signed out. An admin write on staging was not made, since signing in as an admin there needs an emailed link; every recorded write is proven by the API tests.)
- [x] 6.4 Update `openspec/ROADMAP.md` and `docs/HANDOFF.md`, sync specs, archive the change, promote `staging` to `main`, and confirm the production migration and deploy succeeded
