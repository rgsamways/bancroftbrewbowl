# Session Handoff

_Rewritten 2026-10-04 after slice 15. Treat the specifics below as a snapshot, not live truth: check `git log`, `openspec list` and the live site first._

## Start here

The state in one line: **v2 is built, live and archived through slice 15 (cleanup), apart from the optional slice 14 (roles); the `v2.0.0` tag waits for Robin's go.** Every slice (privacy fix, app frame, browser tests, sign-in and passwords, pool total, Home and Pick, Standings, admin activity, admin steps and pools, confirmations, menu, music, From the brewery, help and info, TV and recap) is on production. `CLAUDE.md`'s pace rule applies: don't start anything below unprompted.

What is open, in order:

1. **Tag `v2.0.0`** on `main` (git tag only; package versions stay 0.0.0). Waits for Robin, who first wants the late-start plan settled.
2. **Late start and results cleanup** (Robin's plan, not run): fill the NFL results up to the current week with `pnpm seed-schedule 2026` from `apps/api` (it writes results without scoring, so the missed weeks are a bye for everyone), after checking production has no picks in past weeks; then post a From the brewery announcement that the pool started mid-season. Look at the result on a local database first. Never bulk-write to production without Robin's say-so.
3. **Slice 14, roles** (`docs/ROLES_AND_RULES.md`): only if the owner wants to hand out parts of the work.
4. **Location map** (OpenStreetMap, directions, hours; copy from Tobi's project at `C:/dev/tobisgrabandgo`; needs the real address and hours), then the fun ideas in `docs/IDEAS.md`.

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

- **Production (`bancroftbrewbowl.ca`) runs the whole v2 app.** `main` is the source of truth and deploys both the dashboard (Vercel) and the API (Railway) on push; `staging` mirrors it. Archived changes are under `openspec/changes/archive/`, main specs under `openspec/specs/` (`openspec list` shows only what is still open).
- **No open changes** once `v2-cleanup-and-release` is archived.
- **Order and sizes:** `docs/v2/V2_BUILD_PLAN.md`; status per slice: `openspec/ROADMAP.md`.
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
- **Temporary pieces:** none left from the build. The Activity link lives under More. The retired automatic-offers code is gone; its empty `canned_promotions` table stays on purpose (no destructive migration), and the `canned_promotion_changed` activity kind stays so old records show a title.
- **The schedule import is a script** (`apps/api/scripts/seed-schedule.ts`), not a screen; `apps/api/scripts/make-admin.ts` makes an admin; `apps/api/scripts/reset-password.ts` resets a password (see `docs/NEW_CLIENT_SETUP.md`).

## Decisions already made (don't re-ask; details in memory)

- Look: polished, modern, flat dark surfaces, copper `#c17a45`, Inter, Lucide icons, no motion or sound for now.
- Lives are hidden this season (the `mulligans_allowed` setting stays). No streaks or rank arrows in the first build. "% picked" shows only after the lock.
- No money in the product. The pool total is a display-only number ("Cash handled at the bar, not in this app."). No Stripe. No game-linked drink offers until the owner and AGCO weigh in. "Please drink responsibly." and "You must be 19 or older to play." are in the copy.
- Password sign-in for everyone, link stays the default, no forgot-password flow.
- The owner's wife will control everything and also play. Three admins are expected (her, Robin, the owner). A decision that changes an admin's own standing needs another admin to confirm.
- The menu is public (QR on tables). Drinks, kitchen and live music are first-class. Promotions become "From the brewery" (features, specials, music, announcements).

## Still open

- **Robin's reminders (2026-10-04):** a plan for the late start (NFL week 4) and cleaning up the weekly results, and the location map with directions and hours, last before the fun ideas. Details in `openspec/ROADMAP.md` under "Don't forget".
- Real beer styles and strengths, which beers are seasonal, and the wine and other-drinks list. These can be entered through the admin screens once they exist.
- Whether to build the Admins screen (slice 14).
- Whether the `v2.0.0` tag goes out before or after the late-start results cleanup.
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

## Slice 10 notes (admin-confirmations, 2026-10-04)

- Table `admin_requests` (migration 0007). `POST /pools/:id/wipeouts/:id/resolve` (own entry among those kept) and `PATCH /entries/:id` (own entry) answer 202 with `{ request }` instead of applying, unless the admin is the only admin (`otherAdmins` in `lib/admin-requests.ts`). The apply code is shared by the direct routes and `POST /admin/requests/:id/confirm`.
- Other routes: `GET /admin/requests/:id` (details), `.../decline` (reason up to 200 characters), `.../seen` (requester dismisses a declined note; a requester route, not an admin write, so no activity record). A request goes stale (cancelled) if the wipeout or entry changed since; a direct decision by another admin cancels a waiting one.
- `GET /admin/summary` has `requests` (toConfirm, declined, waiting) and two new next steps, `confirm` and `declined`, ahead of everything but "no schedule".
- Screens are in `pages/AdminRequests.tsx`. Spec: `e2e/admin-confirmations.spec.ts`.
- **Tests now run one file at a time** (`fileParallelism: false` in `vitest.config.ts`): the admin summary reads across the whole database, so a waiting decision in another file's test could change its answer. `activity.test.ts` and `admin-pools.test.ts` mock `otherAdmins` to nothing, so they still test the sole-admin path.
- Local database has leftover admin accounts (names like `canned-verify@example.com`), so locally there is always "another admin".

## Slice 11a notes (menu-items, 2026-10-04)

- Table `menu_items` (migration 0008): `kind` (beer, wine, drink, dish), `section`, name, style, abv (text as typed), description, optional `price_cents`, `options` jsonb (add-ons and side choices), `labels` (new, seasonal), `available`, `sort_order`. Drinks live in the fixed sections On tap, Wine, Other drinks; a dish names its own section. Items show in the order added; there is no reorder screen.
- `GET /public/menu` needs no session and is sent with `Cache-Control: public, max-age=0, must-revalidate` (a 30 second cache made a sold-out switch look stale on reload). Admin routes: `GET/POST /menu/items`, `PATCH /menu/items/:id`, `PATCH .../availability`, `DELETE`. All record Activity (kinds `menu_item_*`, category menu).
- `App.tsx` renders `/menu` and `/menu/kitchen` for signed-out visitors before the sign-in gate (`PublicMenuPage`); signed in they render inside the Shell with the Menu tab (`MenuPage`). Player tabs are Home, Pick, Standings, Menu, Admin; admin bar is Next step, Results, Menu, Pools, More.
- Admin screens are in `pages/admin-menu/` (`draft.ts` holds the form-to-payload logic and has unit tests). Add-ons are typed one per line, price after a comma.
- No seed data. The brewery enters the real list through the screens; production has an empty menu until then. The legal check of the menu wording with the owner and AGCO is still open.
- Tests: `menu.test.ts` (API), `e2e/menu.spec.ts`, `e2e/admin-menu.spec.ts`. E2E items are named "E2E ..." and removed by each test.

## Slice 11b notes (music-events, 2026-10-04)

- Table `music_events` (migration 0009): title, `event_date` (a date), optional `start_time` and `end_time` (Eastern wall-clock as typed, so nothing is converted between time zones). Past events are kept but never shown publicly; admins see them under Past (latest 50).
- `GET /public/music` needs no session (always revalidated) and returns `{ thisWeekend, comingUp }`. The weekend rule lives in `packages/shared/src/music.ts` (`weekendWindow`, `bucketOf`, `easternToday`): Friday to Sunday, the coming one Monday to Thursday, the current one Friday to Sunday with days already gone dropped. Admin routes: `GET /music/events`, `POST`, `PATCH`, `DELETE`, all recorded in Activity (`music_event_*`, category menu).
- The Music tab sits beside Drinks and Kitchen at `/menu/music` (public and signed in). Admin Music is the third sub-tab of the admin Menu (`/admin/menu?tab=music`), with a three-step wizard at `/admin/music/new` and editing at `/admin/music/:id`.
- Left for slice 13 on purpose: the "Live this weekend" Home card and its "show on Home this week" flag (a nullable column to add then).
- Tests: `music.test.ts` (API), `packages/shared/src/music.test.ts` (weekend rule on every weekday, near-midnight Eastern date), `e2e/music.spec.ts`, `e2e/admin-music.spec.ts`. E2E events are named "E2E ..." and removed by each test.

## Slice 12 notes (from-the-brewery, 2026-10-04)

- No new table: `promotions` gained `kind` (announcement, feature, special; older rows are announcements), `menu_item_id` (cascade), `days`, `start_time`, `end_time`, `on_date`, `tag`, and its week columns became nullable (migration 0010). Rules live in `apps/api/src/lib/brewery.ts` (`loadBreweryHome`, `loadShowingNow`) and `packages/shared/src/brewery.ts` (schemas, `scheduleText`, `specialShowsOn`).
- Home: `GET /me/summary` carries `brewery` (`featured`, today's `specials`, `announcement`, which is null when the client shows the standard "Watch with us" text). The "At the brewery" section is only on the main Home view. Order: featured, specials, announcement.
- Admin: `/admin/brewery` (More > From the brewery) with Showing now and Remove; wizards at `/admin/brewery/feature`, `/special`, `/announcement`. Routes `GET /brewery/items`, `POST /brewery/features|specials|announcements`, `DELETE /brewery/items/:id`, all in Activity (`brewery_*`). One feature at a time (a new one replaces the old). No edit screen: remove and post again.
- Removed: `routes/promotions.ts`, `PromotionsPage.tsx`, `WeekWidgets.tsx`, the Promotions nav entries (the old address redirects). The four automatic offers (`canned-promotions` routes and table) stay in the code but nothing links to them; delete in slice 15 if wanted.
- Not built, on purpose: any offer linked to standings or winning (waits on the owner and AGCO), the second single-page announcement form, the past-announcements list.
- Tests: `brewery.test.ts` (API; its own seasons 3700 and up, and every game it creates must be listed for cleanup, a leak there broke other suites that use "latest season"), `packages/shared/src/brewery.test.ts`, `e2e/admin-brewery.spec.ts`, `e2e/brewery-home.spec.ts`.

## Slice 13a notes (help-and-info, 2026-10-04)

- Static pages: How to play at `/help` (linked from Me) and the Admin guide at `/admin/guide` (linked from More), both built from the `Faq` component (native `details`). Copy was updated from the mockups: password sign-in exists, Me is opened from the avatar, From the brewery replaces Announcements, and the guide explains "ask another admin to confirm".
- Install card (`components/InstallCard.tsx`, rule in `lib/install.ts`): shown in a browser tab until "Not now" (kept in `localStorage` as `bbb:install-dismissed`), never when running from the home screen.
- Live this weekend: `GET /me/summary` `brewery.live` is the first music event this weekend (same rule as the Music tab). It is automatic: no "show on Home" switch, and no column for one.
- Table card at `/admin/table-card`: QR drawn in the browser with the `qrcode` package (its own lazy chunk), encoding `<origin>/menu`; Print button; print styles hide everything but the card.
- Test note: `e2e/frame.spec.ts` now waits for the pool tabs before reading them (a missing wait that failed about one run in three once Home got slightly slower).

## Slice 13b notes (tv-and-recap, 2026-10-04)

- `GET /pools/:id/tv` and `GET /pools/:id/recap?week=N` (signed in; no emails; no one else's picks). Pick counts live in one place, `lib/pick-counts.ts`, which returns nothing before the week locks. `lib/recap.ts` has the upset rule and the "latest recap week" rule (latest fully decided week in which the pool had picks, so weeks before a late start have no recap). `GET /me/summary` carries `recapWeek` per entry.
- Biggest upset (survivor only) = the winning team the fewest players picked; equal shares go to the game whose loser more players picked, then the earlier kickoff. Pick 'em recap shows correct of games, points, rank and the leader; no most picked or upset.
- TV page `pages/PoolTv.tsx` sits outside the Shell in `components/TvLayout.tsx` (fixed 1280 by 720 canvas scaled to the screen). Recap page `pages/PoolRecap.tsx` is inside the Shell. Share uses the phone's share sheet, else copies the text.
- "Out this week" counts entries with `eliminated_week = N`, so a waiting wipeout makes it lag until an admin resolves it.
- Tests: `routes/tv-recap.test.ts`, `lib/recap.test.ts`, `packages/shared/src/tv-recap.test.ts`, `e2e/tv.spec.ts` (1280 by 720), `e2e/recap.spec.ts`. Seasons used: API 2910 and up, e2e 2996 to 2998.
- **Late start (Robin's plan, not run yet):** fill results up to the current week with `pnpm seed-schedule 2026` (from `apps/api`; it writes results without scoring, so the missed weeks are a bye for everyone), then post a From the brewery announcement saying the pool started mid-season. Check production has no picks in the past weeks first. Run locally first to look at the results.

## Reveal setting notes (reveal-picks-setting, 2026-10-04)

- Pool rule `reveal_picks` (`at_lock` default, or `after_final_game`) in both rules schemas; it lives in the `pools.rules` JSON, so no migration, and a pool saved before it existed reads as `at_lock` (`revealRuleOf` in `lib/pick-lock.ts`). One test, `isRevealed`, decides whether other players' picks may be shown: the week has locked and, for the later rule, no game is still pending. `getRevealedWeeks` feeds `visiblePicks` for both picks routes; `pickCounts` (TV most picked, recap) uses `isRevealed` too. Own picks are always visible; admins see only "picked" before the reveal.
- Settings has "When other players' picks show"; it saves and locks with the other rules. `PATCH /pools/:id` now compares a locked pool's rules after normalising the stored ones, so saving unchanged old rules is not seen as a change. The admin Picks tab and the TV placeholder follow the rule.
- Tests: `routes/reveal-picks.test.ts`, `e2e/reveal-picks.spec.ts` (season 2969), a step in the Settings e2e.

## Menu import (2026-10-04)

- The brewery's printed menus (kitchen, beer, liquor, non-alcoholic, wine) were transcribed from Robin's photos into `docs/menu-draft.md` and `apps/api/scripts/seed-menu.ts` (52 items, validated with the same schema as the admin screens). `pnpm seed-menu` from `apps/api` is a dry run; `--apply` writes; re-running skips items already there. Operator script, so it writes no Activity records.
- Choices: beers show the three pour prices and their IBU in the description (the app has no section notes); wine uses the 5 oz price with the 9 oz price in the description; the seven beers below the dotted line on the printed sheet are labelled seasonal; the beer flight ($13, choice of 4, extra taster $4 each) is an item at the end of On tap, added after the first run. Muskoka Spirits ($8.00, a canned vodka soda) was added after the first run; re-running the script adds only it.
- Production: first run done 2026-10-04 (52 items). Run on Railway with `--environment production` (the CLI in this folder is linked to staging): `railway ssh --service api --environment production -- pnpm --filter @bbb/api seed-menu`, then again with `--apply`.

## Late-start catch-up steps (2026-10-04) - DONE on production

Done 2026-10-04 by Robin from this list: cleared two early picks (his own: DEN week 3, KC week 4), imported results for all 18 weeks (weeks 1 to 3 decided, week 4 partly), verified with `check-late-start` (0 undecided in weeks 1 to 3, no picks anywhere, 2 of 2 alive). Players have a bye for weeks 1 to 4; the first week anyone can pick is week 5. Still to do: post the "We're starting mid-season" announcement (From the brewery, week 5) and re-run `seed-schedule 2026` after the week 4 games finish and again before week 6 if launch slips.

- `pnpm check-late-start` (read-only, counts only) showed production with 2 players and one pick each in weeks 3 and 4 (Robin chose to clear them so everyone has a clean bye).
- `pnpm clear-early-picks --through 4` lists, then with `--apply` deletes, pending picks in locked weeks up to week 4 only. Then `pnpm seed-schedule 2026` fills the results (no scoring), then post the From the brewery announcement. Run each on production with `railway ssh --service api --environment production -- pnpm --filter @bbb/api <script>`.

## Safe display names (safe-display-names, 2026-10-04)

- A new account is named with its email until the player sets a display name, and Standings showed it. `publicName` / `needsDisplayName` (`packages/shared/src/display-name.ts`) now decide what other players see: an empty or "@" name shows as the part before the "@", else "A player". Used by Standings, TV, the Home champion line and `GET /pools/:id/entries` (`resolveEntry`). Admin-only screens that show emails are unchanged. Home shows a "What should we call you?" card until a real name is saved. Tests: `routes/safe-names.test.ts`, `display-name.test.ts`, `e2e/display-name.spec.ts` (season 2968).

## ESPN results button (espn-results-button, 2026-10-04)

- Admin Results has "Check for results": `GET /admin/results/espn` previews (writes nothing; asks ESPN only for weeks that have kicked off and still have an undecided game); `POST /admin/results/espn/apply` re-reads ESPN itself, fills only still-undecided games that are final, then `scoreGame` per game (same as hand entry), and the route writes one `results_imported` Activity record. A decided game is never overwritten; differences are shown, not applied. ESPN trouble gives a 502 with "enter results by hand".
- `lib/espn.ts` is the one ESPN reader (also used by `scripts/seed-schedule.ts`, which still writes results without scoring). `ESPN_BASE_URL` overrides the address; e2e points it at `e2e/helpers/espn-stub.mjs` (port 3021) so tests never contact ESPN.
- Tests: `routes/espn-results.test.ts` (fake reader), `lib/espn.test.ts`, `e2e/espn-results.spec.ts` (season 2967).
- Weekly routine now: after the games finish, an admin taps Check for results, then Apply. The terminal step is no longer needed.

## Where we stopped (2026-10-07)

- The ESPN "Check for results" button is **live** (dashboard deployed once Vercel's build limit lifted) and the change is archived. Weekly routine: an admin taps Check for results, then Apply. The Vercel build limit (about 150 builds in a day on 2026-10-04) is a risk: batch docs-only commits, skip `staging` pushes for notes, and check build status with `gh api repos/rgsamways/bancroftbrewbowl/commits/<sha>/status`.
- Robin's review notes are in `docs/v2/brew-bowl-review-notes.md`. Done from them: scroll to top on every page (`components/ScrollToTop.tsx`), the admin Menu Music tab highlight (tabs now carry `aria-current`), team colour circles on Pick (`TEAM_COLORS` and `readableOn` in `packages/shared/src/teams.ts`, `teamCircleStyle` in `apps/dashboard/src/lib/teams.ts`). Not started: Home scoreboard and more ESPN content (plan one cached ESPN feed), standings views (a survivor picks-by-week matrix must follow the reveal rule), menu colour circles (needs a colour per item) and photo uploads (needs storage and a decision on cost), playoffs (our ESPN reader only reads the regular season, weeks 1 to 18; playoffs are a different season type and need a rule for weeks 19 to 22), and the games (Concentration, Connect Four, Player Rank Movement, Squares with a legal check). Suggested order: Home scoreboard and the shared ESPN feed, a playoffs plan before January, then the cheapest game to test.
- Still waiting on Robin: post the two From the brewery announcements (week 4 note for Robin and Lark, week 5 general). `v2.0.0` is tagged on `d91744c`.

## Per-game pick locking (per-game-pick-locking, 2026-10-07)

- A pool with `pick_deadline_rule: per_game_kickoff` locks each pick at its own game's kickoff; `first_kickoff_of_week` (the schema default, and every pool saved before this) is unchanged. New pools created through `POST /pools` get per-game (`defaultRulesForType` in `routes/pools.ts`). **Robin's existing pool stays whole-week until an admin switches it in Settings: unlock the rules, "When picks lock" > "At each game's kickoff", lock again.**
- One set of helpers in `lib/pick-lock.ts`: `pickDeadlineRuleOf`, `isGameLocked` (kickoff passed or the game has a result), `getTeamGame`, `getStartedTeamKeys`, `revealPredicate` (the single test for who may see which pick). Writes in `routes/picks.ts` check the team's own game; survivor replace needs both games unlocked and clears the old result; per-game pick 'em allows one pick per game; delete checks the removed team's game.
- Visibility: in a per-game pool a pick shows to others as its game starts (`visiblePicks` takes a per-pick test); the "after the week's last game is final" rule still holds everything. TV most picked (`pickCounts`) counts only started games for per-game pools.
- State: `deriveEntryState` takes an optional `perGame` input (the week's games and the entry's pick teams): survivor is `locked` when its pick's game has started, `picked` while its pick is open, `needs_picks` otherwise; pick 'em needs a pick for every game not yet started. `lockTime` is then the next lock that matters to the entry. The pick sheet marks every game and pick `locked` and says `lockRule` ("week" or "game"); Home entries carry `lockRule` too.
- Any day of the week: nothing assumes Thursday, Sunday or Monday (tests use a Wednesday-to-Monday holiday week and a week opening on a Friday).
- Kickoffs matter more now. "Check for results" also lists games whose kickoff differs from ESPN's (current week and the next two) and Apply updates those that have not started (`schedule_updated` Activity kind, or folded into the results record). Never a started or decided game.
- Admin Next step now says "Games under way" and "First game kicked off" (true for both rules); the admin Picks tab explains per-game reveal; Help and the Admin guide explain both rules.
- Tests: `routes/per-game-picks.test.ts`, `routes/per-game-state.test.ts`, additions in `lib/pick-lock.test.ts`, `entry-state.test.ts`, `pick-visibility.test.ts`, `routes/espn-results.test.ts`; `e2e/per-game-picks.spec.ts` (seasons 2964 to 2966) and steps in `e2e/admin-pools.spec.ts` and `e2e/espn-results.spec.ts` (season 2963).

## Admin tools and the god-user (admin-tools, 2026-10-07)

- `OPERATOR_EMAILS` (server setting) lists the god-user accounts. **It must be set in Railway for production and staging before the screens appear** (for example `OPERATOR_EMAILS=rgsamways@gmail.com`); until then nobody is the god-user and the feature is inert. `lib/operator.ts` has `isOperatorUser` (verified email in the list), `isOperatorAddress`, `isAdminUser` (admin flag or god-user); `requireAdmin` accepts the god-user, `requireOperator` accepts only them; the picks and entries routes treat the god-user as an admin view. `GET /me/access` tells the app (`useAccess` in the dashboard: Admin tab, `RequireAdmin`, `RequireOperator`, More).
- Routes (`routes/operator.ts`): `GET/POST /operator/schedule` (preview and load a season; `lib/schedule-load.ts`), `GET/POST/DELETE /operator/admins`, `GET /operator/users?email=` and `POST /operator/players/:id/sign-in-reset`. Activity kinds: `schedule_loaded`, `admin_added`, `admin_removed`, `sign_in_reset`. The activity coverage test now also checks `requireOperator` routes.
- Screens under More > Site setup (`pages/operator/`): Schedule, Admins, Help someone sign in.
- Tests: `routes/operator.test.ts` (god-user, ordinary admin, player, unverified email, fairness rules, each route), `e2e/operator.spec.ts` (the test API's god-user is `e2e-operator@example.test`, set in the Playwright config).
- Local database note: it can hold leftover admin accounts, so tests that need "the last admin" demote and restore them.

## Where we stopped (2026-10-07, evening)

- `admin-tools` is live and archived. `OPERATOR_EMAILS=rgsamways@gmail.com` is set in Railway production (done by Robin); set it on `api-staging` too if the staging site needs the screens. A tab opened before the setting was applied keeps the old answer until reloaded (the app asks the server once per page load).
- `per-game-pick-locking` is live but **not archived**: Robin's own pool is still on the whole-week rule until he switches it in Settings ("When picks lock"). Archive after he has watched a real week.
- Alignment: the Account and Activity page titles now sit in the same centred column as everything else (`PageHeader` in `components/Shell.tsx`); `e2e/alignment.spec.ts` opens about 40 screens on a wide window and fails if any text leaves the column, so a new screen that does is caught.
- Robin's review notes still not started: Home scoreboard on a shared cached ESPN feed, standings views (survivor picks-by-week matrix, which must follow the reveal rules), menu colour circles and photo uploads, a playoffs plan before January, then the games. Also still open: post the two From the brewery announcements; the staff-roles proposal in `docs/ROLES_AND_RULES.md`; the location map.
- Vercel build limit (see above): this session pushed in batches; check status with `gh api repos/rgsamways/bancroftbrewbowl/commits/<sha>/status`.

