## 1. ESPN reader

- [x] 1.1 `lib/espn.ts`: fetch a week with a timeout and `ESPN_BASE_URL`, map teams (WSH to WAS), decide home win, away win or tie, only treat completed games as final; unit tests with canned ESPN JSON (win, away win, tie, in progress, unknown team)
- [x] 1.2 `scripts/seed-schedule.ts` uses it with no change in behaviour (dry run against the local database to compare)

## 2. Server

- [x] 2.1 `GET /admin/results/espn`: weeks to ask about, undecided-here and final-on-ESPN list, differs list, 502 on failure, admin only; tests with a fake reader
- [x] 2.2 `POST /admin/results/espn/apply`: re-fetch, apply only still-undecided and still-final ids, save result and score, call `scoreGame`, report applied/skipped/wipeout; tests: elimination follows, wipeout held, stale preview, not final, never overwrites, players refused
- [x] 2.3 `results_imported` activity kind and one record per apply (own-entry flag); the activity coverage test passes

## 3. Screen

- [x] 3.1 Results screen: Check for results, the list, Apply N, applied message, wipeout link, nothing new, ESPN-unavailable states

## 4. Tests in a real browser

- [x] 4.1 A small stub ESPN server for e2e (`ESPN_BASE_URL` in the Playwright config, on a private port) and `e2e/espn-results.spec.ts`: check, apply, the games show decided, an elimination follows, nothing-new state, ESPN-down state, a player cannot reach it

## 5. Verify and ship

- [x] 5.1 `pnpm lint`, `typecheck`, `typecheck:e2e`, `test`, `test:e2e` pass
- [x] 5.2 Push to `staging`, check the routes answer (401 signed out), promote to `main` (no migration), confirm the deploy; the first real use is Robin's, watching the preview before applying
- [x] 5.3 Sync specs, archive, update ROADMAP, HANDOFF and the admin guide
