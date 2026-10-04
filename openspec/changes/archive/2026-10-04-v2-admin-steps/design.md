## Context

Admin screens today live inside the player `Shell` with a stopgap four-link sub-navigation and the player tab bar (`Admin` is one player tab). `SchedulePage` is the only place results are entered (five controls in a row per game); `AdminDashboard` holds pools, games, entries, picks and a settings popup. Results go through `POST /nfl/games/:id/result`, which also scores every pool in the season and returns `scoring: [{poolId, scored, eliminated, wipeout}]`. Wipeouts have `GET /pools/:id/wipeouts` and a resolve route. Slice 6 added `loadSeasonWeeks`/`currentWeek` (`lib/entry-state.ts`); slice 8 added the activity record (every write already records). See proposal.md for the why and what Robin decided (two slices, four tabs, announcements to slice 12, a static correction warning).

## Goals / Non-Goals

**Goals:**
- A weekly flow that works on a phone with one thumb: see the step, do it, move on.
- One server-side definition of "what's next" so it is testable.
- No change to how results are scored.

**Non-Goals:**
- Pools, players, picks, settings, new-pool wizard (`v2-admin-pools`); announcements; menu; confirmations; roles; any schema change; restoring knocked-out players on a correction.

## Decisions

- **`GET /admin/summary` owns the next-step logic.** It reuses `loadSeasonWeeks` and `currentWeek` for the latest season that has games, adds pending-and-kicked-off games, unresolved wipeout events across pools, and per-pool alive and total counts, and returns the chosen step. Alternative: let the phone work it out from several existing endpoints. Rejected: that is where Home and Pick once disagreed, and the priority rule deserves a test.
- **Priority: wipeout, then waiting results, then caught up.** A wipeout holds back standings, so it comes first. "Waiting" means kicked off with no result, not "pending", so the card never asks for a result that cannot exist yet. When the season is over the card says the season is complete. The "After that" suggestions in the mockup (announcement, menu, new pool) are other slices' features and are left out; the card has "All admin tools" only.
- **Results use the existing endpoint unchanged.** The list and wizard call `POST /nfl/games/:id/result`; a correction is the same call (Activity already says "changed"). Winner buttons only appear for games that have kicked off: the guard is in the screens, not the server, to avoid changing endpoint behaviour in this slice. Alternative: refuse early results on the server. Deferred: it would be a standing rule change worth its own decision.
- **Wipeout awareness from the response.** The wizard collects every `scoring` entry with `wipeout: true`; the done screen then says a decision is needed and links to it. Because the response does not carry the wipeout id, the screen links by pool and reads `GET /pools/:id/wipeouts`. `GET /pools/:poolId/wipeouts` gains each candidate's picks for that week and an `isYou` flag (admin only, and the week has locked, so picks are not secret).
- **Correction warning is static, by design.** One paragraph, shown when the season has a survivor pool (known from the summary's pool list), plus the pick 'em note. No count and no automatic restore (Robin's call). The recovery path is the roster, which arrives in `v2-admin-pools`; until then the existing pool dashboard's player list is the fix point, and the warning says "on the roster". The old dashboard has no status editor either, so the roster status edit (API exists) is a known gap to close in `v2-admin-pools`; this is noted in the handoff.
- **Admin layout is a separate route group.** `/admin/*` pages render in `AdminLayout` (app header, `AdminTabs`, content) and the task screens in `FocusLayout` (own top row, no tabs). The player `Shell` and `BottomTabs` are untouched. Alternative: branch inside `BottomTabs` on the path. Rejected: it mixes two products' navigation in one component and was the cause of the earlier tab-bar bugs.
- **Routes.** `/admin` Next step, `/admin/results`, `/admin/results/steps` (focus), `/admin/wipeout/:poolId/:wipeoutId` (focus), `/admin/more`, `/admin/activity` and `/admin/promotions` (kept, linked from More), `/admin/pools` and `/admin/pools/:poolId` (the existing dashboard, links updated), `/admin/schedule` redirects to `/admin/results`. The old `/admin/:poolId` shape is replaced by `/admin/pools/:poolId`.
- **The page header hack goes.** `AdminPanelContext` stays only for the old pool dashboard until `v2-admin-pools`.

## Risks / Trade-offs

- [Results are the high-stakes screen] → same endpoint and scoring, buttons only after kickoff, honest done screen, browser checks for entry, correction and the wipeout path.
- [An admin cannot restore a wrongly eliminated player from the new screens until `v2-admin-pools`] → called out in the correction warning and the handoff; the API and the old dashboard are still there; `v2-admin-pools` is next.
- [Replacing routes breaks bookmarks and the `frame`/`admin-*` specs] → old `/admin/schedule` redirects; the affected specs are rewritten in this change.
- [Two admins act at once] → the existing resolve route already refuses an already-resolved wipeout (409); the screen shows that message.
- [The summary's "current week" may surprise before the season starts] → with no kicked-off games the card says caught up; with no games at all it says no schedule.

## Migration Plan

No data change. Push to `staging`, check `GET /admin/summary` answers 401 signed out, walk every screen locally in real Chrome (the staging preview cannot reach the staging API), promote. Rollback is a revert.
