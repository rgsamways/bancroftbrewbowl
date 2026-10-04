# Session Handoff

_Written 2026-10-04, end of the long mockup-and-planning session. If you're reading this significantly later, treat the specifics below as a snapshot, not live truth: check `git log`, `openspec list` and the live site first._

## Start here

The state in one line: **v2 is fully designed and planned, and no app code has been written.** The next job is to start building, one slice at a time, in the order in `docs/v2/V2_BUILD_PLAN.md`, starting with `secure-pick-access`. Wait for Robin's go before starting each slice (`CLAUDE.md` pace rule).

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

- `main` is at the docs-and-mockups commits made at the end of this session; production (`bancroftbrewbowl.ca`) is the old app and unchanged. A `staging` branch and environment exist (see `CLAUDE.md`).
- **Two OpenSpec changes are written, valid and not started:** `secure-pick-access` (do first) and `password-sign-in` (part of slice 4). `openspec list` will show them as in progress with 0 tasks done; that is accurate.
- **Robin's release rule:** each slice goes live as soon as it is verified. No private review gate; he decides. Staging is a quick self-check.

## Things found this session that matter

- **Three real holes in the existing API** (see `secure-pick-access`): any signed-in player can read everyone's picks before the lock, change or delete another player's pick, and read every player's email.
- **better-auth is pinned at 1.1.9** and differs from Tobi's (^1.7). It has no switch to turn off password sign-up, so `password-sign-in` closes those endpoints with `disabledPaths` and proves it in a test first.
- **The `per_game_kickoff` deadline rule exists in pool settings but no server code reads it.** Locking is the first kickoff of the week.
- **The schedule import is a script** (`apps/api/scripts/seed-schedule.ts`), not a screen. `apps/api/scripts/make-admin.ts` makes an admin.
- Adding a player by email and editing a player's status exist in the API but are not in today's admin screens.

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
