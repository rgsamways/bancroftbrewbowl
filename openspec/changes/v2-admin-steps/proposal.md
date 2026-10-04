## Why

The weekly job for the brewery staff is small: enter the results, and sometimes settle a wipeout. Today it is spread over a desktop-style Schedule page (a row of five controls per game), a pool dashboard with four tabs and a settings popup, and a sidebar-era layout squeezed onto a phone. The v2 mockups replace that with a phone-first admin: one "next step" card that says what to do, results one game at a time, and a clear wipeout decision. This is the first half of slice 9 of the v2 build (`docs/v2/V2_BUILD_PLAN.md`); the second half, `v2-admin-pools` (pools, players, picks, settings, the new-pool wizard), follows it.

## What Changes

- **Admin frame:** on admin screens a four-tab bar replaces the player bar: **Next step, Results, Pools, More**. Wizard screens (results one at a time, wipeout) have no tab bar, only Back / Step N of M / Leave. "Menu" joins the bar in slice 11. The old four-link sub-navigation goes.
- **Next step** (`/admin`): one card saying what to do now, from a new `GET /admin/summary`. Priority: a **wipeout decision**, then **results waiting** (games that have kicked off with no result), otherwise **all caught up**. A "Your week" checklist shows schedule loaded, picks locked, results entered and each pool's alive count. With no games loaded it says there is no schedule yet.
- **Results:** a list for the current week with "Waiting for a result", "Not played yet" and "Done" groups, big winner buttons only for games that have kicked off, **Change** on a done result with a plain warning (players it already knocked out in survivor are not brought back; fix them on the roster, pick 'em points fix themselves), and week arrows to correct an earlier week. **Do it game by game** opens the wizard: "Who won? Game 1 of 2", the winner buttons, "It was a tie", "Skip this one for now", then a done screen that is honest: if any result created a wipeout it sends the admin to decide it.
- **Wipeout decision:** a screen for "Everyone would be out": the players, what each picked, tick who stays in, "N of M will stay in", "Keep N players alive". The admin's own entry is marked "You" with a note that the decision is recorded in Activity.
- **More:** Enter results, Activity, All pools, Season schedule check, Switch back to the player view, Me. The old Promotions page stays reachable here until slice 12 replaces it.
- **Removed:** the old Schedule page and its route (Results replaces it; entering scores is dropped from the screens, the API stays) and the old four-link admin sub-navigation.
- Pools keep working on the existing pool dashboard under **Pools** until `v2-admin-pools` rebuilds them.
- Out of scope (decided with Robin): announcements (the wizard waits for slice 12 so nobody posts something players cannot see), the Menu tab and menu or music steps (slice 11), "another admin confirms" (slice 10), pools, players, picks, settings and the new-pool wizard (`v2-admin-pools`), the admin guide (slice 13), and any database change.

## Capabilities

### New Capabilities
- `admin-steps`: the admin frame, the Next step card and its priorities, the results list and wizard, correcting a result, the wipeout decision screen, and the More page.

### Modified Capabilities
<!-- None. app-shell's player tabs are unchanged; admin screens get their own bar. -->

## Impact

- **API** (`apps/api`): new `GET /admin/summary`; `GET /pools/:poolId/wipeouts` also returns what each candidate picked and which candidate is the viewing admin. **No schema change.**
- **Shared** (`packages/shared`): the summary response type and the step priorities' text.
- **Dashboard** (`apps/dashboard`): new admin layout (tab bar), `NextStep`, `AdminResults`, `ResultsWizard`, `WipeoutDecision`, `AdminMore` pages; routes changed (`/admin`, `/admin/results`, `/admin/results/steps`, `/admin/wipeout/:poolId/:wipeoutId`, `/admin/more`, `/admin/pools` and `/admin/pools/:poolId` for the existing dashboard); `SchedulePage` and the admin sub-navigation removed.
- **Tests:** API tests for the summary states; browser specs for every state; `admin-results`, `admin-activity` and `frame` specs updated; the coverage test from slice 8 still passes (no new write routes).
- **Design:** `admin.html`, `admin-caught-up`, `admin-wipeout-alert`, `admin-no-schedule`, `admin-step-results-*`, `admin-results`, `admin-results-correct`, `admin-wipeout`, `admin-more` in `docs/v2/mockups/`.
- **Risk:** results entry decides who is alive, so it is the screen to get right. Mitigations: the same endpoint and scoring as today, winner buttons only after kickoff, an honest done screen, and browser checks of the correction and wipeout paths. No schema change, so rollback is a revert.
