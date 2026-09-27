# Bancroft Brew Bowl — Build Plan

_Last updated: 2026-09-27, reflecting the state of `main` at commit `dacd1e7`._

## What this is

Bancroft Brew Bowl is an NFL survivor-pool (and now pick 'em) web app built for Bancroft Brewing Co., a bar/brewery. It's designed and built as **a template to redeploy per client**, not a shared multi-tenant SaaS platform: each business that wants its own pool-keeping site gets its own separate deployment (own Railway project, own Postgres database, own Vercel project, own domain) running the same codebase. There is no host-header tenant resolution and no shared database — that model was explicitly considered and rejected early on (see "Product direction" below).

The live instance is deployed at **bancroftbrewbowl.ca** (dashboard on Vercel, API on Railway, Postgres on Railway, DNS on Cloudflare, transactional email via Resend). As of this writing both the API and dashboard are live and responding.

## Product direction

- **One deployment per client.** If this is ever sold to a second bar, the plan is to stand up a second, fully independent deployment (new Railway project + Postgres + Vercel project + domain), not to add tenancy to this one. Nothing in the codebase should be built assuming shared/multi-tenant infrastructure.
- **`isAdmin` is a simple global boolean** on the `user` table — no per-pool or per-tenant role scoping, since one deployment always belongs to exactly one business.
- **Multiple pools per deployment** is fully supported today (e.g., a new pool each NFL season, or several concurrent pools of different types for one bar) — this was a day-one design goal, not an afterthought.
- **Two pool types exist**: `survivor` (the original) and `pick_em` (added later, see below). Both were explicit product decisions, not speculative extensibility.

## Tech stack

- **Monorepo**: pnpm workspaces — `apps/api`, `apps/dashboard`, `packages/shared`.
- **Backend** (`apps/api`): Fastify, Drizzle ORM + drizzle-kit against Postgres (`pg` driver), Zod validation, better-auth for authentication, `tsx` for local dev/scripts.
- **Frontend** (`apps/dashboard`): React + react-router (client-side `BrowserRouter`), Vite, Tailwind CSS v4 (CSS-first `@theme` config), lucide-react icons.
- **Shared** (`packages/shared`): pure TypeScript, Zod schemas and enums shared between API and dashboard. Compiled to `dist/` via `tsc` — this matters in production (see "Deployment" below); it is **not** consumed as raw TypeScript source at runtime.
- **Database**: PostgreSQL. Local dev runs it via `docker-compose.yml` (port 5437, chosen to avoid clashing with other local Postgres instances/other projects on this machine).
- **No cron/scheduler**: deliberately avoided. Anything that might look like "run this periodically" (locking picks, scoring games) is instead computed on-demand from data that's already there (e.g., "is this week locked" is derived from `now() >= earliest kickoff`, not set by a job).
- **No third-party sports-data ingestion for live scores** — game results are entered by an admin (from ESPN's public scoreboard data via the schedule importer, or manually), not pulled live.

## Data model

All tables live in `apps/api/src/db/schema.ts`. Migrations are managed with `drizzle-kit generate`/`migrate` (versioned, committed to `apps/api/drizzle/`) — **not** `db:push` in anything production-bound; `db:push` is fine for local iteration only.

| Table | Purpose | Notable design points |
|---|---|---|
| `user`, `session`, `account`, `verification` | better-auth's own tables | Inlined directly in `schema.ts` (not a separate file) because drizzle-kit's loader can't resolve NodeNext `.js`-extension relative imports between two TS files. `user.isAdmin` is the only app-specific addition. |
| `pools` | A single pool instance (one per season per pool, potentially several concurrent) | `type` (`survivor` \| `pick_em`, **immutable after creation**, defaults to `survivor`), `rules` (jsonb, shape depends on `type`), `status` (`draft` \| `active` \| `completed` — doubles as the "locked" flag: `draft` = editable, `active`/`completed` = locked). `seasonYear`, `logoUrl`/`primaryColor`/`secondaryColor` kept for future per-client branding even without multi-tenancy. |
| `entries` | One entrant in one pool | `userId` is nullable and resolved **live** against `user` — name/email are never copied onto the entry, so a user changing their name/email updates every pool/season instantly. `invitedEmail`/`invitedName` hold a placeholder until an admin-invited person actually signs in and the entry gets auto-claimed (see `auth.ts`'s `databaseHooks`). `status`/`eliminatedWeek`/`mulligansUsed` are survivor-only concepts; they're simply unused (always `alive`, `0`) for pick 'em entries. |
| `games` | One real-world NFL game | **Season-scoped, not pool-scoped.** Keyed by `(seasonYear, weekNumber, homeTeam, awayTeam)` and shared by every pool running that season — a game's result is entered once and every matching pool scores off the same row. `result` and `homeScore`/`awayScore` are independent (a score can be recorded without a decided winner and vice versa). |
| `picks` | One entry's pick for one team in one week | Unique on `(entryId, weekNumber, teamCode)` — **not** `(entryId, weekNumber)`, which is what makes double-pick weeks (survivor) and one-pick-per-game (pick 'em) both possible without a schema fork. |
| `wipeoutEvents` | A held-back survivor elimination decision | Created when a game result would eliminate every remaining alive entry in a pool. A partial unique index (`WHERE resolved_at IS NULL`) plus `onConflictDoUpdate` prevents duplicate pending rows if the same game gets re-scored before resolution. |
| `promotions` | Free-text, admin-authored weekly promotions | Season/week-scoped like `games`, not pool-scoped — a bar's "Survivor Sunday" special for week 3 isn't specific to one pool. |
| `cannedPromotions` | Toggleable, automatically-computed promotions | One row per `kind` (`survivor_sunday`, `elimination_consolation`, `milestone_reward`, `hot_team_special`), bar-wide (not per-pool). Eligibility is computed live from `entries`/`games`/`picks` at read time — nothing about *who's* eligible is stored. |

## Feature inventory (what's built)

### Authentication & accounts
- Magic-link sign-in via better-auth (`apps/api/src/auth.ts`), bridged into Fastify via a custom Web-standard Request/Response adapter (`lib/auth-plugin.ts`, `lib/to-web-request.ts`).
- Email change with verification, via better-auth's `changeEmail` plugin.
- Cross-subdomain session cookies (`COOKIE_DOMAIN` env var), needed because the dashboard and API live on different subdomains (`bancroftbrewbowl.ca` vs `api.bancroftbrewbowl.ca`) in production.
- Transactional email via Resend (`lib/email.ts`), with a graceful local-dev fallback that just logs the link to the console when `RESEND_API_KEY` is unset.
- Admin-invited entries (an admin adds someone by email before they've ever signed in) auto-claim to the real account the moment that person signs in, via a `databaseHooks` hook on user create/update.

### Pools (admin)
- Full CRUD: create (with pool-type selection), edit (name, season year, rules), lock/unlock (reuses `pools.status`: `draft` = unlocked, `active` = locked), and delete.
- Delete requires a git-style "type the pool's exact name to confirm" flow, enforced **both** client-side (button stays disabled) and server-side (the API independently checks the typed name matches before deleting) — not just a UI gate.
- Deleting a pool cascades cleanly to its entries, picks, and wipeout events via FK `onDelete: cascade` — verified, not just assumed.
- All pool management lives behind a cog-button modal and a "+"-button modal in the admin Pools page tab row (not a dedicated settings tab — that was tried and deliberately reverted; see "History" below).

### Survivor pool type
- Elimination scoring: a losing (or tied, per `tie_counts_as`) pick eliminates an entry, triggered synchronously when an admin enters a game result — not a scheduled job.
- **Mulligans** (`mulligans_allowed`): auto-applied. A losing pick that would eliminate an entry instead consumes one mulligan, via an atomic conditional `UPDATE ... WHERE mulligans_used < mulligans_allowed` (avoids a race if two games in the same week are scored close together).
- **Double-pick weeks** (`double_pick_weeks`): an entry submits two picks in a designated week instead of one, eliminated if *either* loses.
- **Wipeout weeks**: a result that would eliminate every remaining alive entry in a pool is held back (not auto-applied) and surfaced to the admin as a resolvable banner in the Entries tab — the admin picks which candidates (if any) survive.
- `allow_repeat_teams`, `tie_counts_as` are also enforced. `tiebreaker` and `pick_deadline_rule` exist in the schema but are **not implemented** anywhere (see "Known gaps").

### Pick 'em pool type (straight-up)
- Pick a winner for every game each week (one pick per game, not one per week) — 1 point per correct pick, no elimination.
- **Points are never stored** — they're derived live from `picks.result` at read time (`computePickEmPoints` in `routes/entries.ts`). This makes a corrected game result self-correcting in the standings automatically, with no re-scoring logic needed (a deliberate contrast with survivor's elimination state, which has no such self-correction if a result is corrected after the fact).
- `tie_handling` rule (`void` or `everyone_correct`) controls whether a tied game awards a point to both sides or neither.
- Pick submission reuses the same insert/delete pattern built for survivor's double-pick weeks; the "how many picks are allowed this week" limit is computed as the number of games scheduled that week instead of a fixed 1-or-2.
- Against-the-spread and confidence-pool variants were explicitly discussed and **deferred** — not built, would need real data-model decisions (spread ingestion, confidence-value validation) if ever revisited.

### NFL schedule & scores
- `apps/api/scripts/seed-schedule.ts` imports/upserts a season's full schedule (and any already-decided results/scores) from ESPN's public scoreboard API. Re-runnable safely (upserts, doesn't skip existing rows) — used both for initial import and for backfilling/correcting.
- No stored "current season" setting anywhere (deliberately — see "History"). Anywhere the app needs "the current season," it derives the most recent season year that actually has games imported (`GET /nfl/seasons`, `SELECT DISTINCT`).
- Pick deadlines and "locked" week status are derived (`MIN(kickoffTime)` per `seasonYear`+`weekNumber`), not stored.
- Admin enters/corrects game results and scores from the Schedule page — one entry per game, applied to every pool running that season at once.

### Promotions
- **Free-text** (`promotions` table): admin writes a title/description for a specific season+week. Shown on Home to every signed-in user.
- **Canned/automated** (`cannedPromotions` table): four pre-built, toggleable promotion kinds, each computed live:
  - *Survivor Sunday* — every currently-alive entry.
  - *Elimination Consolation* — entries eliminated in the most recently decided week (derived as `MAX(weekNumber)` among games with a non-pending result — not the same concept as the "upcoming" current week used for picks).
  - *Milestone Rewards* — alive entries, only while the most-recently-decided week matches one of the admin-configured milestone weeks.
  - *Hot-Team Special* — whichever team has the most picks for the upcoming week, aggregated bar-wide across every pool.
- Referral-bonus and "standings on the big screen" promotion ideas were discussed and explicitly deferred — the former needs a referral-tracking data model that doesn't exist; the latter is really a separate public-display feature, not a toggleable promotion.

### Dashboard UI
- **Shell layout**: left nav (`Sidebar.tsx`), center content, and a right drawer (`RightPanel.tsx`) that shows contextual help text for whatever page is open (driven by `getPageHelp(pathname)` in `lib/nav.ts`) — opened via a "?" button on mobile, always visible as a column on desktop.
- **Home page**: the signed-in user's pools/entries, a "join a pool" list for pools they haven't joined, the current week's games, and any active promotions (free-text + eligible canned ones).
- **Admin dashboard** (`/admin`, `/admin/:poolId`): tabs for Pools (list/select), Games (read-only per-week results, admin enters results from the Schedule page instead), Entries (roster + wipeout resolution banner), and Picks (survivor: a week-by-week pick matrix; pick 'em: a sorted points standings list, since one entry can hold several picks in a single pick-'em week — the matrix assumption doesn't hold there).
- **PickScreen**: branches by pool type — survivor shows a flat grid of all NFL teams; pick 'em shows one row per matchup for the current week.
- **PoolStandings** (public, per-pool): survivor shows alive/eliminated sections; pick 'em shows a sorted points leaderboard.
- Branding matches the real Bancroft Brewing Co. site (dark theme, custom fonts/colors via Tailwind's `@theme`).

## Infrastructure & deployment

- **Vercel** (dashboard): git-connected, auto-deploys on push to `main`. `vercel.json` lives at the **repo root** (not `apps/dashboard/`) because Vercel's git-triggered builds clone and build from the true repo root, not a configured "Root Directory" — a real bug hit and fixed during this build (see "History").
- **Railway** (API + Postgres): **git-connected as of 2026-09-27** (migrated off the deprecated Config-as-Code `railway.json` to Infrastructure as Code, `.railway/railway.ts`) — pushing to `main` deploys the API automatically, same as Vercel. Postgres is a separate Railway service, deliberately **not** managed by `.railway/railway.ts` (see `openspec/changes/archive/2026-09-27-railway-iac-git-deploy/design.md`); `DATABASE_URL` is wired via Railway's `${{Postgres.DATABASE_URL}}` variable reference, preserved (not inlined) in the IaC file.
- **Migrations against production**: applied automatically via the API service's `preDeploy` command (`pnpm --filter @bbb/api db:migrate`, run between build and start on every deploy) — no more manual `railway ssh ... db:migrate` step. Still: `pnpm db:generate` locally → commit the generated migration → push, same as before; only the "apply it" step changed.
- **Cloudflare**: DNS only (nameservers pointed at Cloudflare, records set to "DNS only"/grey-cloud so Vercel/Railway can issue their own TLS certs) — not proxied, no Workers, no other Cloudflare product in use.
- **Resend**: domain-verified, auto-configured via Resend's Cloudflare integration. Sends magic-link and change-email confirmation mail; falls back to console-logging locally when `RESEND_API_KEY` is unset.
- **`@bbb/shared` is a real build step in production** — its `package.json` points at compiled `dist/` output, not raw TypeScript source. This is load-bearing: plain `node` (no TypeScript support) runs the compiled API in production, unlike `tsx`/Vite in local dev which transpile on the fly. Forgetting to build `@bbb/shared` before the API/dashboard in a deploy pipeline was a real production outage during this build (see "History").

## Known gaps / explicitly deferred

- `tiebreaker` (survivor) and `pick_deadline_rule` (both pool types) exist in the rules schemas but are **not wired to any real logic anywhere** — deliberately hidden from the Settings UI so admins aren't misled into thinking they do something. If `pick_deadline_rule`'s `per_game_kickoff` option is ever wanted, the deadline-lookup query in `picks.ts` needs to change from `MIN(kickoffTime)` across the whole week to a per-game lookup.
- A known, accepted race: two near-simultaneous pick submissions for the same entry/week in a double-pick (or pick-'em) week could both pass the "under limit" check before either commits, landing at one extra pick before the DB's team-uniqueness constraint blocks a literal duplicate. Not closed with an advisory lock — judged not worth the complexity for this scale of usage.
- Against-the-spread and confidence-pool pick 'em variants: not built.
- Referral-bonus promotion: not built (needs a new referral-tracking data model).
- "Standings on the big screen" promotion idea: not built (it's a separate public-display feature, not really a toggleable promotion).
- Automated test coverage is still thin: a first batch exists (`apps/api/src/lib/scoring.test.ts`, `apps/api/src/routes/entries.test.ts`), covering survivor elimination/mulligan/double-pick/wipeout scoring and pick 'em points derivation, run via `pnpm test` (real Postgres required — see `apps/api/src/test/setup.ts`) and enforced in CI (`.github/workflows/ci.yml`, lint + typecheck + test on push/PR). Most routes still have no tests.

## History worth knowing (recurring lessons from building this)

A few real production incidents shaped decisions above and are worth not re-litigating:

- **"Current season" was deliberately never made a stored setting.** An admin could accidentally change/save it and silently break something unrelated. Everywhere the app needs "the current season," it's derived from actual data (which seasons have games imported) instead.
- **`packages/shared` shipping raw TypeScript broke production** the first time the API was deployed — `node` has no TS support, only `tsx`/Vite do. Fixed by giving it a real `tsc` build and pointing `railway.json`'s build command at `pnpm --filter @bbb/api... build` (the `...` builds workspace dependencies first).
- **A too-recent `pnpm` version (bleeding-edge "latest") crashed Railway's build** because its bundled corepack couldn't fetch/execute it. Pinned to a mature `9.15.0` release in the root `package.json` instead.
- **Vercel's git-triggered deploys build from the true repo root**, not whatever "Root Directory" was inferred from a local CLI deploy — `vercel.json` had to move from `apps/dashboard/` to the repo root, and `Project Settings`' cached install/build commands (which silently override `vercel.json` once set) had to be explicitly reset via `vercel project update`.
- **The Pools UI structure went through several iterations** (a right-column persistent form → a dedicated Settings tab → a modal triggered by a cog button) based on direct user feedback each time. The modal-based approach is current; don't assume the right-column version if referencing an old screenshot or memory of this project.
- **`railway config plan`/`apply` are broken on this Windows dev machine** (2026-09-27): `railway@3.11.0`'s own version-compatibility check misreads its executable path when the Railway CLI spawns its IaC evaluator, throwing a misleading "upgrade your CLI" error regardless of actual CLI version — reproduced identically in Git Bash and native PowerShell, so it's not a shell quirk. Worked around by using the Railway MCP's `connect-service-source`/`update-service` (staged) + `get-staged-changes`/`accept-deploy` instead, which hit Railway's API directly and bypass the broken CLI evaluator entirely. Revisit `railway config plan` once Railway ships a fix — it should report no changes needed against the current `.railway/railway.ts`.
