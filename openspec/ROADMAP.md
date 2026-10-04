# Roadmap

Living tracker across changes. Keep current when a change's status changes.

## Next: Brew Bowl v2 (major version)

Easier to use, phone-first front end with a polished, modern look, built with the same simple process as the Tobi's Grab & Go site. Why and principles: `docs/v2/V2_PLAN.md`. **Order of work and what each slice contains: `docs/v2/V2_BUILD_PLAN.md`.** Who can do what: `docs/ROLES_AND_RULES.md`. Ideas that aren't planned yet (for example in-brewery games): `docs/IDEAS.md`.

**Status (2026-10-04): slices 1 to 13b and 15 are built and live; 14 (roles) is optional and not started; the `v2.0.0` tag waits for Robin's go.** About 115 clickable mockup pages in `docs/v2/mockups/` (start at `index.html`) were the design; decisions are in the project memory.

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
| 12 | `from-the-brewery` | **Done and archived** (`archive/2026-10-04-from-the-brewery`). Extends `promotions` (migration 0010): featured item, specials, announcements; "At the brewery" on Home; admin From the brewery hub and wizards; interim Promotions page and the automatic offers removed from the screens. 282 tests, 73 real-browser checks. |
| 13a | `help-and-info` | **Done and archived** (`archive/2026-10-04-help-and-info`). How to play (`/help`), Admin guide, install card on Home, automatic "Live this weekend" card, printable table card with a real QR to `/menu`. No schema change. 286 tests, 78 real-browser checks. |
| 13b | `tv-and-recap` | **Done and archived** (`archive/2026-10-04-tv-and-recap`). TV standings at `/pool/:id/tv` (signed in, 16:9, refreshes every 30 s, QR) and the weekly recap at `/pool/:id/recap` with Share, a Home recap card and a Show on TV link; survivor and pick 'em; upset = the winner the fewest players picked; pick counts only after the lock. No schema change. 306 tests, 83 real-browser checks. |
| 14 | `roles-and-rules` | Optional; only if the owner wants to hand out parts of the work |
| 15 | `v2-cleanup-and-release` | **Done and archived** (`archive/2026-10-04-v2-cleanup-and-release`). Removed the dead automatic-offers code (the empty `canned_promotions` table stays on purpose), fixed button contrast on Me, refreshed BUILD_PLAN, HANDOFF, NEW_CLIENT_SETUP and README. No schema change. **`v2.0.0` is not tagged yet: waiting for Robin's go (he wants the late-start plan settled first).** |

### After v2 (Robin's requests, 2026-10-04)

- `reveal-picks-setting`: **Done and archived** (`archive/2026-10-04-reveal-picks-setting`). Per-pool rule for when other players' picks show (at the lock, or after the week's last game is final); no schema change.
- `safe-display-names`: **Done and archived** (`archive/2026-10-04-safe-display-names`). Other players never see an email as a name (Standings, TV, player list); Home asks for a display name until one is set. No schema change. `v2.0.0` tagged 2026-10-04 on `d91744c`.
- Noted in `docs/IDEAS.md`, not started: staff QR page, weekly in-person check-in, per-game pick locking, an "Update results from ESPN" button, staff roles (see `docs/ROLES_AND_RULES.md`).

## Don't forget (Robin, 2026-10-04)

- **Late start and results cleanup.** _DONE on production 2026-10-04 except the announcement post and a re-run of the import once week 4 finishes (see HANDOFF). Plan agreed with Robin (2026-10-04): bring results up to the current week and treat the missed weeks as a bye for everyone (scoring only eliminates on a losing pick, so no one is eliminated); tell players the pool starts mid-season. `pnpm seed-schedule 2026` in `apps/api` already loads ESPN results without scoring. Robin said "do it later"; nothing has run on production._ The NFL is in week 4 and the site is starting several weeks in (Robin: launch is now expected in week 5 or 6, so more weeks are missing). We need a plan to clean up the NFL weekly results (production still has none entered for the early weeks) and to tell players the site started late so they understand. Raise it with Robin; don't bulk-score production without his say-so. Wording can use the From the brewery announcement tool or slice 13.
- **Location map, last.** An OpenStreetMap with the brewery's location and directions, business hours and similar details. Do it after the v2 slices and before the fun ideas (`docs/IDEAS.md`). Reference Tobi's project at `C:/dev/tobisgrabandgo` (it uses `leaflet`; see `public/map.js` and `src/server/app.ts`) and add Brew Bowl's own flavour. Needs the real address and hours from the owner.

## In planning

- `password-sign-in`: optional email and password sign-in for players and admins alongside the emailed link (the link stays the default and the only way to create an account; 10 character minimum; no forgot-password flow; operator reset script). Planning artifacts complete and valid (`openspec/changes/password-sign-in`); not started. No schema change. It is part of slice 4.

## Shipped

See `openspec/changes/archive/` and `docs/BUILD_PLAN.md`.
