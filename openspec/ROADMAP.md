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
| 2 | `v2-shell` | **Planned and valid** (`openspec/changes/v2-shell`, 11 tasks). Waiting for Robin's go to build. |
| 3 | `e2e-smoke` | Not written |
| 4 | `password-sign-in` + `v2-signin` | `password-sign-in` planned and valid; `v2-signin` not written |
| 5 | `pool-total` | Not written (one nullable column) |
| 6 | `v2-home-and-pick` | Not written |
| 7 | `v2-standings` | Not written |
| 8 | `admin-activity-log` | Not written (one table) |
| 9 | `v2-admin-steps` | Not written |
| 10 | `admin-confirmations` | Not written (one table) |
| 11 | `menu-and-music` | Not written (needs a plan-mode design pass first; new tables) |
| 12 | `from-the-brewery` | Not written (extends `promotions`) |
| 13 | `v2-help-and-extras` | Not written |
| 14 | `roles-and-rules` | Optional; only if the owner wants to hand out parts of the work |
| 15 | `v2-cleanup-and-release` | Not written; tags v2.0.0 |

## In planning

- `password-sign-in`: optional email and password sign-in for players and admins alongside the emailed link (the link stays the default and the only way to create an account; 10 character minimum; no forgot-password flow; operator reset script). Planning artifacts complete and valid (`openspec/changes/password-sign-in`); not started. No schema change. It is part of slice 4.

## Shipped

See `openspec/changes/archive/` and `docs/BUILD_PLAN.md`.
