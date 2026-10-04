## 1. Shared

- [ ] 1.1 Add the admin summary response type (`AdminSummary`, the next-step kinds) to `@bbb/shared`; verify with `pnpm typecheck`

## 2. API

- [ ] 2.1 Add `GET /admin/summary` (admin only): current season and week via `loadSeasonWeeks`/`currentWeek`, games with results versus waiting (kicked off, no result) versus not played, waiting wipeouts across pools, per-pool alive and total counts, schedule loaded, and the single next step in the priority order; verify with tests for no schedule, results waiting, a future game not counting as waiting, caught up, season complete, a wipeout outranking waiting results, counts, signed out 401 and player 403
- [ ] 2.2 Extend `GET /pools/:poolId/wipeouts` with each candidate's picks for that week and an `isYou` flag; verify with tests that picks and `isYou` are right for the viewing admin's own entry and for others, and that players still get 403

## 3. Dashboard: frame

- [ ] 3.1 Add `AdminLayout` (app header, content, `AdminTabs` with Next step, Results, Pools, More, current one marked, 44 pixel targets) and `FocusLayout` (Back, optional "Step N of M", Leave, no tabs); route `/admin`, `/admin/results`, `/admin/more`, `/admin/pools`, `/admin/pools/:poolId`, `/admin/activity`, `/admin/promotions` through them, make `/admin/schedule` redirect to `/admin/results`, remove the old sub-navigation, and update the old pool dashboard's links to `/admin/pools/:poolId`; verify with `pnpm typecheck`, `lib/tabs.test.ts` updated, and a browser check that the admin bar replaces the player bar on admin pages and the player bar is unchanged elsewhere

## 4. Dashboard: Next step

- [ ] 4.1 Build `NextStep` (card with Start, "Needs your attention" for a wipeout, caught up, no schedule, season complete, "Your week" checklist, "All admin tools"); verify with screenshots at 390 by 844 against `admin.html`, `admin-caught-up.html`, `admin-wipeout-alert.html`, `admin-no-schedule.html` and a browser check per state

## 5. Dashboard: Results

- [ ] 5.1 Build `AdminResults` (current week list with Waiting, Not played yet and Done groups, winner and tie buttons only after kickoff, "N of M entered", week arrows, link to the one-at-a-time screen); verify against `admin-results.html` and a browser check that entering a result moves the game to Done and a future game has no buttons
- [ ] 5.2 Add Change with the "Change this result?" panel and the survivor and pick 'em warnings, "Keep it as it is" writing nothing; verify against `admin-results-correct.html` and browser checks for keep, change, and the warning showing only when the season has a survivor pool
- [ ] 5.3 Build `ResultsWizard` (Step N of M, winner buttons, tie, skip, note) and the honest done screen that links to a wipeout when one was created; verify against `admin-step-results-1/2/done.html` and browser checks for two games, skip, leave part way, and a result that creates a wipeout

## 6. Dashboard: Wipeout and More

- [ ] 6.1 Build `WipeoutDecision` (candidates with their picks, tick who stays, live counter, "Keep N players alive", "You" marker and Activity note, return to Next step); verify against `admin-wipeout.html` and a browser check that two kept of five leaves three eliminated and Activity records it
- [ ] 6.2 Build `AdminMore` (Enter results, Activity, All pools, season schedule check, Promotions kept until slice 12, switch back to the player view, Me); verify against `admin-more.html` and a browser check that switching back lands on player Home

## 7. Tests, verify and ship

- [ ] 7.1 Rewrite `e2e/admin-results.spec.ts`, update `e2e/admin-activity.spec.ts` (Activity via More), `e2e/pool-total.spec.ts` and `e2e/frame.spec.ts` (admin bar, routes) and `e2e/pick-privacy.spec.ts` for the new routes, delete the old Schedule page, add `e2e/admin-steps.spec.ts` for each state, and check no sideways scroll and 44 pixel buttons; verify `pnpm test:e2e` passes
- [ ] 7.2 Run `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:e2e`, `pnpm test` and `pnpm test:e2e` and verify all pass, and that the activity coverage test still passes
- [ ] 7.3 Walk the screens in real Chrome at 390 by 844 against the local stack (ports 3011 and 5183 only) and call `GET /admin/summary` on `api-staging`; record what was seen
- [ ] 7.4 Update `openspec/ROADMAP.md`, `docs/V2_BUILD_PLAN.md` and `docs/HANDOFF.md` (note the roster status-edit gap that `v2-admin-pools` closes), sync specs, archive the change, push to `staging`, then promote to `main` and confirm the deploys
