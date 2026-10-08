## 1. Reading ESPN's live fields

- [x] 1.1 `lib/espn.ts`: parse state (upcoming, live, final), short status text, clock and period, records, TV network and the teams on a bye, with plain words for delayed, postponed and cancelled; never read odds; unit tests with canned ESPN JSON for every state (pre, live, halftime, overtime, final, postponed, bye)

## 2. The cached feed

- [x] 2.1 `lib/scoreboard.ts`: current week and season by our own rule, in-memory cache with the three lifetimes, one fetch at a time, last good answer kept for an hour when ESPN fails; tests with a fake clock and a fake reader (live, quiet, soon, failure, long failure, shared fetch)
- [x] 2.2 `GET /me/scoreboard` (signed in only): games, byes, `asOf`, `stale`, and the player's own picks per pool; tests: signed out, own picks only and no one else's, no odds anywhere in the answer, no scoreboard when there are no games

## 3. Home

- [x] 3.1 Scoreboard section under the hero: live first, then upcoming, then final; team circles, records, network, "Your pick" marks, byes, "Show all" past six, updated-at line; hidden when empty
- [x] 3.2 Refresh timer: 30 seconds while live, a few minutes otherwise, paused while the tab is hidden, refresh on return; no error shown on failure

## 4. Tests in a real browser

- [x] 4.1 Extend the ESPN stand-in with live status, clock, records and network; `e2e/scoreboard.spec.ts`: live, upcoming and final rows in order, own pick marked, byes listed, "Show all", a refresh updates the score (fake clock), ESPN down shows nothing, no sideways scroll at 390 wide; update Home specs for the new section

## 5. Verify and ship

- [x] 5.1 `pnpm lint`, `typecheck`, `typecheck:e2e`, `test`, `test:e2e` pass
- [x] 5.2 One push to `main` (mind the Vercel build limit); look at it on a phone during a live game
- [x] 5.3 Sync specs, archive, update ROADMAP and HANDOFF
