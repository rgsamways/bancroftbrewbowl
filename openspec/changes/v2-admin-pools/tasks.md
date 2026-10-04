## 1. Shared and API

- [ ] 1.1 Make `display_name` optional in `createEntrySchema`, add `updateEntrySchema` (status, elimination week 1 to 25 or null, nothing else) to `@bbb/shared`; verify with schema unit tests
- [ ] 1.2 Validate `PATCH /entries/:entryId` with `updateEntrySchema` (Alive clears the week, Out needs a week); verify with route tests for restoring a player, eliminating with a week, Out without a week refused, week 99 refused, unknown field refused, player 403, and that the Activity record is still written and flagged for the admin's own entry
- [ ] 1.3 Make `POST /pools/:poolId/entries` take an email alone: an existing account is linked, an unknown email without a name answers 422 `NAME_REQUIRED`, with a name it is invited; adding someone already in the pool changes nothing; verify with route tests for all four cases and that the Activity record is written
- [ ] 1.4 Add `invited` and `isYou` to the admin view of `GET /pools/:poolId/entries` only; verify with tests that an admin sees both flags and a player's view does not
- [ ] 1.5 Refuse name, season and rule changes on a locked pool in `PATCH /pools/:poolId` unless the same request unlocks it, still allowing the pool total and the status; verify with tests for locked refused, unlocked allowed, unlock-and-edit together, equal values not counted as changes, total always allowed, and that the existing pool-total and activity tests still pass

## 2. Dashboard: list and pool screen

- [ ] 2.1 Build `AdminPools` (list with kind, season, players, status chip, New pool) and the pool screen shell (header, Players | Picks | Settings tabs driven by `?tab=`, no Picks tab for Pick 'em), routed at `/admin/pools` and `/admin/pools/:poolId`; verify with a screenshot at 390 by 844 against `admin-pools.html` and a browser check of the tabs for both pool types
- [ ] 2.2 Build the Players tab (count summary, search over everyone, short list and Show all, Alive or Out wk N or points, Invited and You marks, waiting-wipeout banner); verify against `admin-roster.html` and browser checks for search beyond the short list, the Invited mark and the banner
- [ ] 2.3 Add the inline status editor (Alive or Out, week, Save, Cancel, the own-entry note); verify against `admin-roster-edit.html` and `admin-roster-edit-self.html` and a browser check that a knocked-out player is restored, a player is eliminated in a chosen week, an invalid edit shows a plain error, and Activity records both
- [ ] 2.4 Add the Add a player form (email, then name only if needed); verify against `admin-roster-add.html` and browser checks for an existing account, a new person and someone already in the pool
- [ ] 2.5 Build the Picks tab (week picker, counts, chips, hidden teams before the lock, admin's own row shown, after-lock results); verify against `admin-picks.html` and `admin-picks-prelock.html` and browser checks before and after a lock, including that no other player's team appears in the page before the lock

## 3. Dashboard: settings, delete, wizard

- [ ] 3.1 Build the Settings tab (read-only fields and "Rules are locked" banner with Unlock, editable fields with Lock, the pool total form, plain errors including the server's locked refusal); verify against `admin-pool.html` and browser checks for locked, unlocked, unlock then edit, and the pool total working while locked (updating `e2e/pool-total.spec.ts`)
- [ ] 3.2 Build Delete pool (explanation, type-the-name, disabled until it matches, return to the list); verify against `admin-pool-delete.html` and a browser check that a wrong name deletes nothing and the right name does, with Activity recording it
- [ ] 3.3 Build the four-step new-pool wizard in the focus layout (name, type, check the rules for both kinds, review with season, Open the pool, done with the join link, Change a rule), including a retry when locking fails; verify against `admin-step-pool-*` / `season-*` mockups and browser checks for opening a Survivor and a Pick 'em pool, Change a rule, and a player then joining from the link
- [ ] 3.4 Remove `AdminDashboard.tsx`, `AdminPoolsPanel.tsx`, `AdminPanelContext.tsx` and the page-title code that only served them; verify with `pnpm typecheck`, `pnpm lint` and no remaining imports

## 4. Tests, verify and ship

- [ ] 4.1 Update `e2e/pool-total.spec.ts`, `e2e/pick-privacy.spec.ts` and `e2e/frame.spec.ts` for the new pool routes, add `e2e/admin-pools.spec.ts` for each flow, and check no sideways scroll and 44 pixel buttons on every new screen; verify `pnpm test:e2e` passes
- [ ] 4.2 Run `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:e2e`, `pnpm test` and `pnpm test:e2e` and verify all pass, and that the activity coverage test still passes
- [ ] 4.3 Walk the screens in real Chrome at 390 by 844 against the local stack (ports 3011 and 5183 only) and check the changed endpoints answer 401 signed out on `api-staging`; record what was seen
- [ ] 4.4 Update `openspec/ROADMAP.md`, `docs/HANDOFF.md` and `docs/v2/V2_BUILD_PLAN.md`, sync specs, archive the change, push to `staging`, then promote to `main` and confirm the deploys
