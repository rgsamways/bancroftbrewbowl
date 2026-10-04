# Roadmap

Living tracker across changes. Keep current when a change's status changes.

## Next: Brew Bowl v2 (major version)

Easier to use, phone-first front end with a polished, modern look, built with the same simple process as the Tobi's Grab & Go site. Why and principles: `docs/v2/V2_PLAN.md`. **Order of work and what each slice contains: `docs/v2/V2_BUILD_PLAN.md`.** Who can do what: `docs/ROLES_AND_RULES.md`. Ideas that aren't planned yet (for example in-brewery games): `docs/IDEAS.md`.

**Status (2026-10-04): design done, build not started.** About 115 clickable mockup pages in `docs/v2/mockups/` (start at `index.html`, or `gallery.html` for thumbnails) cover the player screens, the step-by-step admin, sign-in and password, the menu and music, and the fairness safeguards for an admin who also plays. Decisions are in the project memory. No app code has changed.

**Release rule (Robin):** each slice goes live as soon as I have verified it myself. There is no private review gate; Robin decides. Staging is a quick self-check, not a waiting room.

### Build order (each becomes its own OpenSpec change when its turn comes)

| # | Change | Status |
| --- | --- | --- |
| 1 | `secure-pick-access` | **Done and archived** (`archive/2026-10-04-secure-pick-access`). Live on production since 2026-10-04 (commit `6408182`). 54 tests; 21 real-session checks passed on staging. The extra two-account check on production was skipped at Robin's decision. |
| 2 | `v2-shell` | **Done and archived** (`archive/2026-10-04-v2-shell`). Live since 2026-10-04 (commit `70cb66c`): header, bottom tabs, Inter and copper tokens. 79 tests; 27 real-browser checks at 390 wide. Leaves temporary pieces for later slices to remove (see HANDOFF.md). |
| 3 | `e2e-smoke` | **Done and archived** (`archive/2026-10-04-e2e-smoke`). `pnpm test:e2e` runs 25 real-browser checks at 390 wide against a local stack; CI runs them too. Test tooling only; no app change. |
| 4 | `password-sign-in` + `v2-signin` | `v2-signin` **done and archived** (2026-10-04): public frame, resend, link-problem page, first-run welcome; 31 real-browser checks. `password-sign-in` **done and archived** (`archive/2026-10-04-password-sign-in`) after Robin confirmed it on his phone. |
| 5 | `pool-total` | **Done and archived** (`archive/2026-10-04-pool-total`). One nullable column `pools.pool_total_cents`; admin sets it in pool settings, players see it on Standings. 120 tests, 33 real-browser checks. |
| 6 | `v2-home-and-pick` | **Done and archived** (`archive/2026-10-04-v2-home-and-pick`). Home hero with pool chips, all states for survivor and pick 'em, the Pick screen (confirm bar, double-pick, tap-to-pick, locked, out), join pages, `GET /me/summary` and `GET /entries/:id/pick-sheet`. 155 tests, 46 real-browser checks. No schema change. |
| 7 | `v2-standings` | **Done and archived** (`archive/2026-10-04-v2-standings`). One-request standings for survivor and pick 'em: summary cards, pool total, Find a player, Show all, shared ranks (T4), pool tabs, Final standings. 163 tests, 49 real-browser checks. No schema change. |
| 8 | `admin-activity-log` | **Done and archived** (`archive/2026-10-04-admin-activity-log`). Table `admin_activity`; every admin write route records who, what, which pool, when and whether it touched the admin's own entry; admin-only Activity page with filters and paging; coverage test against silent gaps. 190 tests, 50 real-browser checks. |
| 9a | `v2-admin-steps` | **Done and archived** (`archive/2026-10-04-v2-admin-steps`). Admin tab bar (Next step, Results, Pools, More), Next step card from `GET /admin/summary`, results list and one-at-a-time wizard, corrections with a warning, wipeout decision, More. 201 tests, 55 real-browser checks. No schema change. |
| 9b | `v2-admin-pools` | **Done and archived** (`archive/2026-10-04-v2-admin-pools`). Pools list, pool screen (Players roster with status edit and add, Picks for Survivor, Settings with lock/unlock and delete), four-step new-pool wizard; the server refuses rule changes on a locked pool and validates status edits. 210 tests, 61 real-browser checks. No schema change. |
| 10 | `admin-confirmations` | **Done and archived** (`archive/2026-10-04-admin-confirmations`). Table `admin_requests` (migration 0007); keeping yourself alive in a wipeout, or changing your own status, becomes a request another admin confirms or declines from Next step; a sole admin is applied at once. 224 tests, 63 real-browser checks. |
| 11a | `menu-items` | **Done and archived** (`archive/2026-10-04-menu-items`). Table `menu_items` (migration 0008); public menu at `/menu` and `/menu/kitchen` with no sign-in, Menu tab for players, admin Menu (list with in/out switch, four-step add wizard, edit, remove). 244 tests, 66 real-browser checks. |
| 11b | `music-events` | **Done and archived** (`archive/2026-10-04-music-events`). Table `music_events` (migration 0009); public music list at `/menu/music` (this weekend, coming up), Music tab beside Drinks and Kitchen, admin Music (list, three-step wizard, edit, remove). 267 tests, 70 real-browser checks. |
| 12 | `from-the-brewery` | Not written (extends `promotions`). Also takes the announcement wizard moved out of slice 9 so nobody posts something players cannot see. |
| 13 | `v2-help-and-extras` | Not written |
| 14 | `roles-and-rules` | Optional; only if the owner wants to hand out parts of the work |
| 15 | `v2-cleanup-and-release` | Not written; tags v2.0.0 |

## In planning

- `password-sign-in`: optional email and password sign-in for players and admins alongside the emailed link (the link stays the default and the only way to create an account; 10 character minimum; no forgot-password flow; operator reset script). Planning artifacts complete and valid (`openspec/changes/password-sign-in`); not started. No schema change. It is part of slice 4.

## Shipped

See `openspec/changes/archive/` and `docs/BUILD_PLAN.md`.
