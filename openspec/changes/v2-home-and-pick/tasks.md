## 1. Prove the assumptions

- [ ] 1.1 Confirm how kickoff times are stored and serialised (UTC or not) with a scratch check against the real database and the existing `/nfl/games` route, and record the finding in design.md; verify that a known UTC kickoff renders as the right Eastern time with `Intl` in a small unit test
- [ ] 1.2 Confirm in a scratch test that a mulligan-pool entry that loses and survives is still `alive` in the data (so "out" can safely mean `eliminated` only) and note it in design.md

## 2. Shared helpers

- [ ] 2.1 Add `rankWithTies` (competition ranking with a tie flag), `formatCountdown` ("2d 14h 37m", "3h 5m", "12m", "less than a minute"), `formatKickoff`/`dayHeading` in Eastern time, and the summary and pick-sheet types to `@bbb/shared`; verify with unit tests for ties (1,2,2,4), all-zero (everyone T1), each countdown format and a kickoff at an Eastern day boundary

## 3. API

- [ ] 3.1 Add `apps/api/src/lib/entry-state.ts` (current week, lock time, state per the design) and verify with tests covering needs picks, partly picked in a double-pick week, picked, locked, eliminated, season over, no games, a week decided before the next opens, and a mulligan pool
- [ ] 3.2 Add `GET /me/summary` (session required, own entries only, server time, counts, rank for pick 'em) and verify with route tests for every state in the home spec, shared ranks, signed out refused, and that no other player's picks or email appear
- [ ] 3.3 Add `GET /entries/:entryId/pick-sheet` (owner only) and verify with tests: owner gets games, picks, used teams and limit; another player and an admin get 403 with no picks; unknown entry 404; signed out 401
- [ ] 3.4 Refuse a pick for a team with no game that week in `POST /entries/:entryId/picks`; verify with tests that a bye-week team is refused with the picks unchanged and a playing team is accepted, and that the existing `pick-access` tests still pass

## 4. Dashboard building blocks

- [ ] 4.1 Add `useServerClock`/`Countdown` (offset from `serverNow`, ticks each minute, flips to locked and refetches at zero), `PoolChips`, `GameCard` (team card with used/selected/picked/locked states) and `ConfirmBar` components; verify with `pnpm typecheck` and a component-level screenshot at 390 by 844
- [ ] 4.2 Add the summary and pick-sheet fetch hooks and the join/pick routes in `App.tsx` (`/join/:poolId`), keeping the existing routes working; verify with `pnpm typecheck` and `pnpm lint`

## 5. Home

- [ ] 5.1 Rewrite `Home.tsx` as the hero for every survivor state (not picked, picked, locked, out, season over) with the pool line, countdown, buttons and "Please drink responsibly."; verify with screenshots against `home.html`, `home-picked.html`, `home-locked.html`, `home-eliminated.html`, `home-offseason.html` and a browser check per state
- [ ] 5.2 Add the pick 'em hero states (picks to make, all picked, locked, season over) with points, rank and progress; verify against `home-pickem.html`, `home-pickem-done.html`, `home-pickem-locked.html` and a browser check per state, including a shared "T" rank
- [ ] 5.3 Add the pool switcher, the "pools you can join" list, the no-pools and first-run states, and the Pick 'Em offer for eliminated players; remove the old games list, promotions and canned-promotion blurbs from the player Home; verify with `home-nopools.html`, a two-pool browser check that the right pool is selected first and switching works, and that no lives or offer wording appears

## 6. Pick screen

- [ ] 6.1 Rewrite `PickScreen.tsx` for survivor: games by day with Eastern kickoffs, team cards, "Used week N" dimming, confirm bar, "Locked in" state and change flow; verify against `pick.html`, `pick-selected.html`, `pick-locked-in.html` and a browser check that selecting does not save until "Lock in"
- [ ] 6.2 Add the double-pick week (chips, "1 of 2 picked", disabled button, partial-failure refetch); verify against `pick-double.html` and a browser check, including a forced failure of the second save
- [ ] 6.3 Add pick 'em tap-to-pick with progress, "Jump to next", per-game serialised saves and the all-picked state; verify against `pick-pickem.html`, `pick-pickem-done.html` and a browser check including two quick taps on one game and a failed save
- [ ] 6.4 Add the locked view (both types), the eliminated "Your season" view with pick history and the Pick 'Em link, and keep "That isn't your entry" on a 403; verify against `pick-closed.html`, `pick-pickem-locked.html`, `pick-eliminated.html`, `pick-not-yours.html` and a browser check per state
- [ ] 6.5 Rework the Pick tab (`TabLanding.tsx`, `lib/tabs.ts`) to use the summary's attention order; verify with `lib/tabs.test.ts` updated and a browser check for one pool, several pools, all out, and no pool

## 7. Join

- [ ] 7.1 Add `/join/:poolId` (rules, name line, "Join <pool>", "Not now"), the finished-pool page, and make the first-run welcome and Home list link to it; verify against `join.html`, `join-pickem.html`, `join-closed.html` and a browser check that joining lands on the pick screen, "Not now" does not join, and a finished pool shows no join button

## 8. Tests, verify and ship

- [ ] 8.1 Update `e2e/join-and-pick.spec.ts`, `e2e/pick-privacy.spec.ts` and `e2e/frame.spec.ts` for the new screens, add a past-kickoff option to `e2e/helpers/db.ts`, and add specs for each Home and Pick state; verify `pnpm test:e2e` passes
- [ ] 8.2 Run `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:e2e`, `pnpm test` and `pnpm test:e2e` and verify all pass
- [ ] 8.3 Walk every state in real Chrome at 390 by 844 against the local stack (ports 3011 and 5183 only) and call the two new endpoints on `api-staging`; record what was seen
- [ ] 8.4 Update `openspec/ROADMAP.md` and `docs/HANDOFF.md`, sync specs, archive the change, push to `staging`, then promote to `main` and confirm the deploys
