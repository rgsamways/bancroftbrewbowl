# Session Handoff

_Rewritten 2026-10-04 at the end of the long build session (slices 1 to 9). If you're reading this significantly later, treat the specifics below as a snapshot, not live truth: check `git log`, `openspec list` and the live site first._

## Start here

The state in one line: **v2 is fully designed and planned; slices 1 to 9 (9a and 9b) are built, live and archived (privacy fix, app frame, real-browser tests, password and sign-in screens, pool total, Home and Pick, Standings, the admin activity record, the admin steps, the pool screens); `password-sign-in` stays open only for a real-phone password-manager check.** The next job is slice 10, `admin-confirmations` (one new table, so a schema-change call-out before pushing), in the order in `docs/v2/V2_BUILD_PLAN.md`. Wait for Robin's go before starting each slice (`CLAUDE.md` pace rule).

Read, in order:

1. This file.
2. `docs/v2/V2_BUILD_PLAN.md`: the order of work, what each slice contains, which ones change the database, and how releases work.
3. `docs/v2/mockups/index.html` (open in a browser; `gallery.html` shows thumbnails). About 115 clickable pages for every player screen, the step-by-step admin, sign-in and password, the menu and music, and the fairness safeguards. The "Viewing as" switch (Player / Admin / All) filters the index and shows or hides the Admin tab. The pages are generated static HTML; edit the HTML directly.
4. `docs/ROLES_AND_RULES.md`: who can do what, the rules the app must always keep, and the "another admin confirms" rule.
5. `docs/v2/V2_PLAN.md`: the original why and the legal guardrails.
6. `docs/BUILD_PLAN.md`: the architecture of the app that already exists (still accurate).
7. The project memory at `C:\Users\rgsam\.claude\projects\c--dev-bancroftbrewbowl\memory\`, especially `project_v2_gamelike_frontend.md`, which records every design decision made so you don't ask again.
8. `docs/IDEAS.md`: parked ideas (in-brewery games). Don't start them unprompted.

## Where things stand

- **Production (`bancroftbrewbowl.ca`) runs the v2 app through slice 9.** `main` is the source of truth and deploys both the dashboard (Vercel) and the API (Railway) on push; `staging` mirrors it. Archived changes are under `openspec/changes/archive/`, main specs under `openspec/specs/` (`openspec list` shows only what is still open).
- **Built and live:** secure pick access, the v2 shell, browser tests, password sign-in and the sign-in screens, pool total, Home and Pick (with join pages), Standings, the admin activity record, the admin steps (Next step, Results, wipeout) and the pool screens (list, players, picks, settings, new-pool wizard).
- **Open change: `password-sign-in`** (14 of 16 tasks done, built and live). Two things remain: task 5.3, Robin checking on a real phone that the password manager offers to fill and save and that the email field shows the email keyboard; then task 5.4's archive (`openspec archive password-sign-in`). Don't archive before Robin confirms.
- **Next slice: 10, `admin-confirmations`** (one new table `admin_requests`; the "another admin confirms" rule in `docs/ROLES_AND_RULES.md`). It is not written yet. Plan it with `openspec-propose`, call out the schema change before pushing, and run the migration on staging's own database first. After that: 11 `menu-and-music` (needs a plan-mode design pass, new tables, adds the Menu tab to both tab bars), 12 `from-the-brewery` (also takes the announcement wizard moved out of slice 9), 13 help and extras, 14 optional roles, 15 cleanup and the v2.0.0 tag. Order and sizes: `docs/v2/V2_BUILD_PLAN.md`; status per slice: `openspec/ROADMAP.md`.
- **Robin's rules:** every slice goes live as soon as it is verified; no review gate; he decides. Wait for his go before starting each slice (plan first with `openspec-propose`, build only after he says go). Never write test data to production. Update the matching spec in `e2e/` whenever a slice changes a screen. Keep explanations short and simple. Ports 3001 and 5173 belong to other projects: never touch them.

## Things that matter (learned while building)

- **better-auth is pinned at 1.1.9** (Tobi's is ^1.7). Its `disabledPaths` option is typed but does nothing at runtime, so password sign-up and reset are refused by a hook in `apps/api/src/auth.ts` (`passwordHook`). Its rate limiter only runs when `NODE_ENV=production` and only matches paths when the request URL starts with `BETTER_AUTH_URL`; both are handled (`rateLimit` in `auth.ts`, `to-web-request.ts` honours `x-forwarded-proto`).
- **Weeks and states have one definition:** `apps/api/src/lib/entry-state.ts` (current week = first week with an undecided game; a week locks at its first kickoff; `per_game_kickoff` exists in settings but nothing reads it). Home, Pick, the Pick and Standings tabs and the admin Next step all use it. Kickoffs are stored as UTC and shown in Eastern time (`packages/shared/src/game-time.ts`).
- **One request per screen:** `GET /me/summary` (Home), `GET /entries/:id/pick-sheet` (Pick), `GET /pools/:id/standings` (Standings), `GET /admin/summary` (Next step), `GET /admin/activity` (Activity). Countdowns use the server's time sent with the response.
- **Every admin write route records who did it** in `admin_activity` through `recordActivity` (`apps/api/src/lib/activity.ts`), and a test (`activity-coverage.test.ts`) fails if a new admin write route has no record or if app code updates or deletes a record. New kinds of change are added to `packages/shared/src/admin-activity.ts` (no migration).
- **Server rules worth knowing:** a pick must be for a team that plays that week; a locked pool refuses name, season and rule changes; a player's status edit is validated (Out needs a week 1 to 25); picks stay hidden until the week locks, for admins too, except their own.
- **Schema changes so far in this build:** `pools.pool_total_cents` and the `admin_activity` table (migrations 0005 and 0006). Railway's `preDeploy` migrates automatically; call out any schema-changing push first.
- **Testing:** `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:e2e`, `pnpm test` (API tests use the real Docker Postgres) and `pnpm test:e2e` (real Chrome at 390 by 844, own API on 3011 and dashboard on 5183, refuses a non-local database). Test cleanup removes the data and the activity records its own admins made; if rows pile up locally, a test skipped cleanup. Seasons used by tests: 3500 and up for anything that calls the admin summary (it looks at the latest season with games), 2000 to 2100 for anything that edits a pool's season (schema limit), around 2970 to 2999 for the rest.
- **The staging preview site can't call the staging API** (`api-staging` has no `DASHBOARD_URL`), so screens are checked locally in real Chrome and staging is checked by calling its API.
- **Editing files with Python on this Windows machine:** always pass `encoding="utf-8"`; the default (cp1252) once wrote a bad byte into a source file. In the Bash tool, heredocs containing apostrophes can fail to parse: write such files with the Write tool, or write a script file and run it.
- **Temporary pieces still in place:** the Promotions page (reachable from admin More) and its automatic offers, until slice 12 replaces them; the Activity link lives under More until menu items arrive. Old pages may still have white text on copper buttons (3.4 to 1 contrast); fix with dark ink when each is redone.
- **The schedule import is a script** (`apps/api/scripts/seed-schedule.ts`), not a screen; `apps/api/scripts/make-admin.ts` makes an admin; `apps/api/scripts/reset-password.ts` resets a password (see `docs/NEW_CLIENT_SETUP.md`).

## Decisions already made (don't re-ask; details in memory)

- Look: polished, modern, flat dark surfaces, copper `#c17a45`, Inter, Lucide icons, no motion or sound for now.
- Lives are hidden this season (the `mulligans_allowed` setting stays). No streaks or rank arrows in the first build. "% picked" shows only after the lock.
- No money in the product. The pool total is a display-only number ("Cash handled at the bar, not in this app."). No Stripe. No game-linked drink offers until the owner and AGCO weigh in. "Please drink responsibly." and "You must be 19 or older to play." are in the copy.
- Password sign-in for everyone, link stays the default, no forgot-password flow.
- The owner's wife will control everything and also play. Three admins are expected (her, Robin, the owner). A decision that changes an admin's own standing needs another admin to confirm.
- The menu is public (QR on tables). Drinks, kitchen and live music are first-class. Promotions become "From the brewery" (features, specials, music, announcements).

## Still open

- Real beer styles and strengths, which beers are seasonal, and the wine and other-drinks list. These can be entered through the admin screens once they exist.
- Whether to build the Admins screen (slice 14).
- Legal check of the menu and promotion wording with the owner and AGCO.
- The pick 'em versions of some admin screens (settings and picks) aren't mocked; only survivor is.

## Practical reminders (unchanged)

- Local dev: `pnpm install && pnpm docker:up && cp .env.example apps/api/.env && pnpm db:migrate && pnpm dev:api && pnpm dev:dashboard` (API :3001, dashboard :5173, Postgres :5437).
- Both Vercel and Railway are git-connected: push to `main` deploys both, and migrations run automatically in Railway's `preDeploy`. No manual `railway up`.
- `packages/shared` must be built before the apps resolve it; `pnpm typecheck` and `pnpm test` do that for you.
- Don't store "current season". `pools.type` is immutable. `games` are season-scoped. See `BUILD_PLAN.md`'s History section.
- OpenSpec is mandatory for non-trivial changes: propose, design, tasks, apply, archive, with real verification per task.

## Slice 6 notes (v2-home-and-pick, 2026-10-04)

- Home and the Pick screen each load with one request: `GET /me/summary` and `GET /entries/:entryId/pick-sheet` (owner only). Both use `apps/api/src/lib/entry-state.ts`, the one definition of the current week and an entry's state. The server's time comes with each response; countdowns use it, not the phone's clock.
- Kickoffs are stored as UTC and shown in Eastern time (`packages/shared/src/game-time.ts`). Pick 'em ranks use `rankWithTies` in `packages/shared/src/rank.ts` (Standings reuses it in slice 7).
- The server now refuses a pick for a team with no game that week.
- Left out on purpose (Robin's call): the "At the brewery" cards (slices 11 to 13), the full-screen "Tough break" moment and the "added by the brewery" notice (no stored flag), the Menu tab.
- Browser tests: `home-states`, `pick-states`, `join-and-pick`, `frame`, `pick-privacy` cover every Home and Pick state.

## Slice 7 notes (v2-standings, 2026-10-04)

- Standings loads from one request, `GET /pools/:poolId/standings`, which returns already-sorted lists, counts, shared pick 'em ranks and "after week N". It sends names, status, elimination weeks and points only: no emails, no picks (a test pins this). Search and "Show all" work on the full list on the phone.
- `initials` now lives in `@bbb/shared` (`standings.ts`) and is shared by the header and the lists.
- Only your own row links anywhere (to your pick screen). The Standings and Pick tabs both open the pool that needs attention first, the same choice as Home.

## Slice 8 notes (admin-activity-log, 2026-10-04)

- Table `admin_activity` (migration 0006). Every admin write route calls `recordActivity` with the signed-in admin passed in explicitly (`apps/api/src/lib/activity.ts`); the sentence is stored as written, so renames and deletes cannot rewrite history. Kinds, titles and categories live in `packages/shared/src/admin-activity.ts`: add menu, music and confirmation kinds there, no migration needed.
- A coverage test (`lib/activity-coverage.test.ts`) fails if an admin write route has no `recordActivity`, and if any app code updates or deletes a record. There is no route to edit or delete one.
- `GET /admin/activity` (admin only, 50 per page, cursor, filters). The Activity page is `/admin/activity`, linked from the interim admin sub-navigation until slice 9 moves it under "More".
- Test cleanup removes the records its own admins made (`cleanupFixtures`, `TestDb.cleanup`). If local activity rows ever pile up, they came from a test that skipped cleanup.
- Python on this Windows machine writes files in cp1252 unless told otherwise: always pass `encoding="utf-8"` when editing source with a script (a stray byte once corrupted an en dash in `nfl.ts`).

## Slice 9a notes (v2-admin-steps, 2026-10-04)

- The admin side has its own layout (`components/AdminLayout.tsx`): bottom bar Next step, Results, Pools, More, and a bar-less `FocusLayout` for task screens (results one at a time, wipeout). `RequireAdmin` sends non-admins home; the server still enforces admin access. The old Schedule page is gone (`/admin/schedule` redirects to Results). The pool dashboard now lives at `/admin/pools` and `/admin/pools/:poolId`.
- `GET /admin/summary` chooses the next step (`routes/admin-summary.ts`, `chooseNextStep`): no schedule, then a waiting wipeout, then results for games that have kicked off with no result, then season complete or caught up. "Current season" is the latest season that has games, which is why tests that call it use seasons far above everything else (3500 and up).
- Result buttons only appear for games that have kicked off; this is a screen rule, the endpoint is unchanged. Entering scores is no longer in the screens (the API remains).
- The roster status gap noted here was closed by `v2-admin-pools` (slice 9b).
- Announcements and the Menu tab were deliberately left for slices 12 and 11. Promotions stays reachable under More until then.

## Slice 9b notes (v2-admin-pools, 2026-10-04)

- Pools: `/admin/pools` (list), `/admin/pools/:poolId?tab=players|picks|settings`, and the four-step wizard at `/admin/pools/new` (no tab bar). Components live in `pages/admin-pool/`. The old four-tab dashboard, its popups and `AdminPanelContext` are gone.
- Players tab: search, Show all, Invited and You marks, inline Alive/Out editor (restores wrongly eliminated players), Add a player (email first; the form asks for a name only after the server answers 422 `NAME_REQUIRED`). A waiting wipeout is flagged with a link.
- Picks tab is Survivor only; teams stay hidden before the lock for everyone except the admin's own row (the server already enforces this).
- **Server rules added:** `PATCH /pools/:id` refuses name, season and rule changes on a locked pool (409) unless the same request unlocks it; the total and the lock always work. `PATCH /entries/:id` is validated (`updateEntrySchema`; Out needs a week 1 to 25). `GET /pools/:id/entries` adds `invited` and `isYou` for admins only.
- Admin edits of their own entry are allowed and flagged in Activity; slice 10 turns that into "ask another admin to confirm".
- Test seasons: API/e2e tests that touch the admin summary use seasons 3500+; tests that edit a pool's season through the API must stay inside 2000 to 2100 (the schema limit).
