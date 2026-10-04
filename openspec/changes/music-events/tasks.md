## 1. Schema and shared

- [ ] 1.1 Add `music_events` table and migration 0009 (additive); run it on the local database
- [ ] 1.2 Shared: Eastern today and weekend helpers with unit tests for every weekday and a date near midnight UTC; event schemas (title, date, times, end after start); time formatting ("1 – 4 PM"); the three music activity kinds

## 2. API (tests first, real Postgres)

- [ ] 2.1 `GET /public/music` with no session: this weekend and coming up, no past events, revalidate header; test it
- [ ] 2.2 Admin `GET /music/events`, `POST`, `PATCH`, `DELETE`; 401 signed out, 403 for players; validation tests
- [ ] 2.3 Each admin write records Activity in the same transaction; coverage test passes
- [ ] 2.4 Register the routes in `index.ts` and the test harness

## 3. Public and player screen

- [ ] 3.1 Music sub-tab and list at `/menu/music` (public and signed-in routes), with empty state and "Time to be confirmed"

## 4. Admin screens

- [ ] 4.1 Music sub-tab in the admin Menu with Coming up and Past lists
- [ ] 4.2 Three-step add wizard and done screen; edit screen with Save and Remove (asks first)

## 5. Tests in a real browser

- [ ] 5.1 `e2e/music.spec.ts`: visitor and player see the list, times, empty state, no sideways scroll at 390 wide
- [ ] 5.2 `e2e/admin-music.spec.ts`: add, edit, remove; update any spec that lists the Menu sub-tabs

## 6. Verify and ship

- [ ] 6.1 `pnpm lint`, `typecheck`, `typecheck:e2e`, `test`, `test:e2e` pass
- [ ] 6.2 Call out the schema change; push to `staging`; confirm the migration ran on staging's own database and `/public/music` answers
- [ ] 6.3 Promote to `main`; confirm the production deploy and migration; check `/public/music` on production (read only, no test data)
- [ ] 6.4 Archive (syncs specs), update ROADMAP and HANDOFF
