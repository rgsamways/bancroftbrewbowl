## 1. Schema and shared

- [x] 1.1 Extend `promotions` (kind, menu item, days, times, date, tag; week columns nullable) with migration 0010 (additive); run it on the local database
- [x] 1.2 Shared `brewery.ts`: kinds and tags, create schemas for feature, special and announcement, schedule text ("Sundays, 1 – 4 PM"), day and date matching, summary types; unit tests; new activity kinds

## 2. API (tests first, real Postgres)

- [x] 2.1 `routes/brewery.ts`: `GET /brewery/items`, `POST` feature, special and announcement, `DELETE`; 401 signed out, 403 for players; validation, one feature at a time, cascade when the item is removed; Activity records; coverage test passes
- [x] 2.2 `GET /me/summary` returns `brewery` (featured, today's specials, current announcement) under the rules in the spec; tests for each rule
- [x] 2.3 Remove `routes/promotions.ts` and move its tests; register the new routes in `index.ts` and the test harness

## 3. Player screen

- [x] 3.1 Home "At the brewery" section (featured, specials, announcement or the standard message) on the main Home view only

## 4. Admin screens

- [x] 4.1 From the brewery hub at `/admin/brewery` with Showing now and Remove (asks first); More links to it; the old Promotions page, route and nav entries removed, old address redirects
- [x] 4.2 Feature wizard (2 steps), special wizard (3 steps, with the wording reminder), announcement wizard (3 steps) and their done screens

## 5. Tests in a real browser

- [x] 5.1 `e2e/admin-brewery.spec.ts`: hub, each wizard, remove asks first, no sideways scroll at 390 wide
- [x] 5.2 `e2e/brewery-home.spec.ts`: a player sees the feature, today's special and the announcement; the standard message when none; a switched-off featured item disappears; update `e2e/frame.spec.ts` for Promotions

## 6. Verify and ship

- [x] 6.1 `pnpm lint`, `typecheck`, `typecheck:e2e`, `test`, `test:e2e` pass
- [x] 6.2 Call out the schema change; push to `staging`; confirm migration 0010 ran on staging's own database and `/me/summary` still answers
- [ ] 6.3 Promote to `main`; confirm the production deploy and migration (read-only checks, no test data)
- [ ] 6.4 Archive (syncs specs), update ROADMAP and HANDOFF
