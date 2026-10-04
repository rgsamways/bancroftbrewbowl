## 1. Shared

- [x] 1.1 Move `initials` from `AppHeader.tsx` to `@bbb/shared`, add the standings response types, and verify with `pnpm typecheck` and a unit test for initials ("Robin Samways" gives RS, one word gives two letters, an email gives its first letter)

## 2. API

- [x] 2.1 Add `GET /pools/:poolId/standings` for survivor pools (counts, "last decided week", alive list with the viewer first, eliminated list most recent first, `me`); verify with route tests for ordering, counts, week line, an eliminated viewer, a viewer with no entry, unknown pool 404 and signed out 401
- [x] 2.2 Add the pick 'em leaderboard to the same route using `rankWithTies` and `computePickEmPoints` (points descending, ties by name, leader points, `me`); verify with tests for a four-way tie followed by the right next rank, points under `everyone_correct` ties, and that the answer contains no email address and no picks for either pool type
- [x] 2.3 Add `seasonOver` and "no week decided yet" handling; verify with tests for a pool with no decided week, a partly decided season, and a fully decided season

## 3. Dashboard

- [x] 3.1 Rewrite `PoolStandings.tsx` for survivor: summary card, `PoolTotalCard`, Find a player, short lists with Show all, "You" row linking to the viewer's pick screen, "Nobody yet" lists; verify with a screenshot at 390 by 844 against `standings.html` and a browser check of each element
- [x] 3.2 Add the pick 'em summary and leaderboard with shared ranks and the note; verify against `standings-pickem.html` and a browser check that two tied players both show "T4" and the next shows 6
- [x] 3.3 Add search over the full list (not only the shown rows) and the "No players match" state; verify with a browser check that a player beyond the short list is found and that clearing restores the short list
- [x] 3.4 Add the pool tabs (when in more than one pool) and replace the Standings tab landing with a redirect to the pool that needs attention (shared choice with Home and Pick); rewrite `TabLanding.tsx` as the one shared landing for the Pick and Standings tabs and delete `pickDestination`/`standingsDestination`; verify with `lib/tabs.test.ts` updated and browser checks for one pool, two pools and no pool
- [x] 3.5 Add the "Final standings" wording for a finished season; verify with a browser check on a pool whose games are all decided

## 4. Tests, verify and ship

- [x] 4.1 Update `e2e/standings.spec.ts`, `e2e/frame.spec.ts` and `e2e/pick-privacy.spec.ts` for the new screens, and check that no sideways scroll and 44 pixel tap targets hold on Standings; verify `pnpm test:e2e` passes
- [x] 4.2 Run `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:e2e`, `pnpm test` and `pnpm test:e2e` and verify all pass
- [x] 4.3 Walk both pool types in real Chrome at 390 by 844 against the local stack (ports 3011 and 5183 only) and call the new endpoint on `api-staging`; record what was seen (Both pool types walked by browser specs and screenshots; `api-staging` answers 401 signed out for the new route. The staging preview site cannot reach the staging API.)
- [x] 4.4 Update `openspec/ROADMAP.md` and `docs/HANDOFF.md`, sync specs, archive the change, push to `staging`, then promote to `main` and confirm the deploys
