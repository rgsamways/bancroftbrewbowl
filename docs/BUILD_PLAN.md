# Bancroft Brew Bowl — Build Plan

_Last updated: 2026-10-04, after the v2 build (slices 1 to 15). For what each v2 slice added and why, see `docs/v2/V2_BUILD_PLAN.md` and `docs/HANDOFF.md`; for a snapshot of the code at any time, trust `git log` over this file's commit references._

## What this is

Bancroft Brew Bowl is an NFL survivor-pool (and now pick 'em) web app built for Bancroft Brewing Co., a bar/brewery. It's designed and built as **a template to redeploy per client**, not a shared multi-tenant SaaS platform: each business that wants its own pool-keeping site gets its own separate deployment (own Railway project, own Postgres database, own Vercel project, own domain) running the same codebase. There is no host-header tenant resolution and no shared database — that model was explicitly considered and rejected early on (see "Product direction" below).

The live instance is deployed at **bancroftbrewbowl.ca** (dashboard on Vercel, API on Railway, Postgres on Railway, DNS on Cloudflare, transactional email via Resend). The v2 phone-first front end is what runs there now.

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
| `pools` (additions) | | `pool_total_cents` (nullable): a display-only number shown on Standings; the app never handles money. |
| `promotions` | "From the brewery": featured item, specials and announcements | Extended in v2 with `kind` (`announcement`, `feature`, `special`), optional `menu_item_id`, `days`, `start_time`, `end_time`, `on_date`, `tag`; week columns are nullable. Rules in `apps/api/src/lib/brewery.ts` and `packages/shared/src/brewery.ts`. |
| `menu_items` | Drinks and dishes | `kind` (beer, wine, drink, dish), section, name, style, abv, description, optional price, add-on `options` (jsonb), `labels`, `available`, `sort_order`. Public read at `GET /public/menu`. |
| `music_events` | Live music | Title, `event_date`, optional start and end time (Eastern wall-clock as typed). Public read at `GET /public/music`; the weekend rule is in `packages/shared/src/music.ts`. |
| `admin_activity` | Append-only record of admin changes | Who, what, which pool, when, and whether it touched the admin's own entry. Written by every admin write route through `recordActivity`; a test fails if a route skips it or if app code updates or deletes a record. |
| `admin_requests` | "Another admin confirms" | A change to an admin's own standing waits here until another admin confirms or declines; a sole admin is applied at once. |
| `cannedPromotions` | **Retired.** The four automatic offers were removed from the app in v2 | The table and its migration are kept (no destructive migration); nothing reads or writes it. |

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
- Pool management is on the admin Pools screens (v2): the list, the pool screen with Players, Picks and Settings tabs, and a four-step new-pool wizard. A locked pool refuses name, season and rule changes (the pool total and the lock itself always work).

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

### From the brewery (promotions)
- Admins feature one menu item at a time, add specials (days and times) and post announcements from **More > From the brewery** (`/admin/brewery`). Home shows them under "At the brewery": featured, today's specials, then the announcement (or the standard "Watch with us" text), with an automatic "Live this weekend" card from the music list.
- No offer is linked to standings or winning (waits on the owner and AGCO). The four automatic offers of v1 are gone from the app.

### Menu and music
- Public menu at `/menu`, `/menu/kitchen` and `/menu/music` with no sign-in (the table QR code opens it); players see it under the Menu tab. Admins manage items (in or out switch, add wizard, edit, remove) and music events from the admin Menu.

### TV and recap
- TV standings at `/pool/:id/tv` (signed in, 16:9, refreshes every 30 s, QR to the site) and the weekly recap at `/pool/:id/recap` with a Share button. Pick counts (most picked, biggest upset) are computed on request and only after a week locks (`lib/pick-counts.ts`).

### Dashboard UI (v2)
- **Look:** dark flat surfaces, copper `#c17a45`, Inter, Lucide icons (tokens in `apps/dashboard/src/index.css`). Phone first, tested at 390 by 844.
- **Player shell** (`components/Shell.tsx`): `AppHeader` (logo, avatar to Me) and `BottomTabs` (Home, Pick, Standings, Menu, plus Admin for admins). Public pages (sign-in, menu) have no bar. The TV page sits outside the shell (`TvLayout`).
- **Home** (`GET /me/summary`, one request): a hero for the entry that needs attention, a pool switcher, every state for survivor and pick 'em, a recap card, the install card and "At the brewery".
- **Pick** (`GET /entries/:id/pick-sheet`): team cards with a confirm bar for survivor, tap-to-pick for pick 'em. **Standings** (`GET /pools/:id/standings`): summary, pool total, Find a player, shared ranks.
- **Admin** (`AdminLayout`, bar-less `FocusLayout` for task screens): Next step (`GET /admin/summary`), Results (one game at a time, with corrections), Menu, Pools (players, picks, settings, new-pool wizard) and More (From the brewery, Activity, Admin guide, Table card). Changes to an admin's own standing go through "another admin confirms".
- **Weeks and states** have one definition, `apps/api/src/lib/entry-state.ts`: the current week is the first week with an undecided game; a week locks at its first kickoff. Kickoffs are stored as UTC and shown in Eastern time.
- **Sign-in:** emailed link, or a password set on the Me page (no forgot-password flow; operator script `reset-password`).

## Infrastructure & deployment

- **Vercel** (dashboard): git-connected, auto-deploys on push to `main`. `vercel.json` lives at the **repo root** (not `apps/dashboard/`) because Vercel's git-triggered builds clone and build from the true repo root, not a configured "Root Directory" — a real bug hit and fixed during this build (see "History").
- **Railway** (API + Postgres): **git-connected as of 2026-09-27** (migrated off the deprecated Config-as-Code `railway.json` to Infrastructure as Code, `.railway/railway.ts`) — pushing to `main` deploys the API automatically, same as Vercel. Postgres is a separate Railway service, deliberately **not** managed by `.railway/railway.ts` (see `openspec/changes/archive/2026-09-27-railway-iac-git-deploy/design.md`); `DATABASE_URL` is wired via Railway's `${{Postgres.DATABASE_URL}}` variable reference, preserved (not inlined) in the IaC file.
- **Migrations against production**: applied automatically via the API service's `preDeploy` command (`pnpm --filter @bbb/api db:migrate`, run between build and start on every deploy) — no more manual `railway ssh ... db:migrate` step. Still: `pnpm db:generate` locally → commit the generated migration → push, same as before; only the "apply it" step changed.
- **Staging environment (added 2026-09-27)**: a `staging` git branch, a separate Railway environment (own `api-staging` service, own Postgres, own generated domain), and Vercel's automatic Preview deployment for that branch — verify a change there before merging `staging` → `main`. See `CLAUDE.md`'s Deploy pipeline section and `openspec/changes/archive/2026-09-27-staging-environment` for exact details, including a real footgun hit while building it (`railway environment create --duplicate` does not isolate resources — do not use it).
- **Cloudflare**: DNS only (nameservers pointed at Cloudflare, records set to "DNS only"/grey-cloud so Vercel/Railway can issue their own TLS certs) — not proxied, no Workers, no other Cloudflare product in use.
- **Resend**: domain-verified, auto-configured via Resend's Cloudflare integration. Sends magic-link and change-email confirmation mail; falls back to console-logging locally when `RESEND_API_KEY` is unset.
- **`@bbb/shared` is a real build step in production** — its `package.json` points at compiled `dist/` output, not raw TypeScript source. This is load-bearing: plain `node` (no TypeScript support) runs the compiled API in production, unlike `tsx`/Vite in local dev which transpile on the fly. Forgetting to build `@bbb/shared` before the API/dashboard in a deploy pipeline was a real production outage during this build (see "History").

## Known gaps / explicitly deferred

- `tiebreaker` (survivor) and `pick_deadline_rule` (both pool types) exist in the rules schemas but are **not wired to any real logic anywhere** — deliberately hidden from the Settings UI so admins aren't misled into thinking they do something. If `pick_deadline_rule`'s `per_game_kickoff` option is ever wanted, the deadline-lookup query in `picks.ts` needs to change from `MIN(kickoffTime)` across the whole week to a per-game lookup.
- A known, accepted race: two near-simultaneous pick submissions for the same entry/week in a double-pick (or pick-'em) week could both pass the "under limit" check before either commits, landing at one extra pick before the DB's team-uniqueness constraint blocks a literal duplicate. Not closed with an advisory lock — judged not worth the complexity for this scale of usage.
- Against-the-spread and confidence-pool pick 'em variants: not built.
- Referral-bonus promotion: not built (needs a new referral-tracking data model).
- Roles and rules beyond the single `isAdmin` flag (v2 slice 14): not built; see `docs/ROLES_AND_RULES.md`.
- The location map with directions and hours, and in-brewery games (`docs/IDEAS.md`): not built.
- **Tests:** `pnpm test` (API and shared tests against the real Docker Postgres, one file at a time) and `pnpm test:e2e` (real Chrome at 390 by 844 against a local stack on ports 3011 and 5183; refuses a non-local database). Both run in CI (`.github/workflows/ci.yml`). Every slice that changes a screen updates the matching spec in `e2e/`.

## History worth knowing (recurring lessons from building this)

A few real production incidents shaped decisions above and are worth not re-litigating:

- **"Current season" was deliberately never made a stored setting.** An admin could accidentally change/save it and silently break something unrelated. Everywhere the app needs "the current season," it's derived from actual data (which seasons have games imported) instead.
- **`packages/shared` shipping raw TypeScript broke production** the first time the API was deployed — `node` has no TS support, only `tsx`/Vite do. Fixed by giving it a real `tsc` build and pointing `railway.json`'s build command at `pnpm --filter @bbb/api... build` (the `...` builds workspace dependencies first).
- **A too-recent `pnpm` version (bleeding-edge "latest") crashed Railway's build** because its bundled corepack couldn't fetch/execute it. Pinned to a mature `9.15.0` release in the root `package.json` instead.
- **Vercel's git-triggered deploys build from the true repo root**, not whatever "Root Directory" was inferred from a local CLI deploy — `vercel.json` had to move from `apps/dashboard/` to the repo root, and `Project Settings`' cached install/build commands (which silently override `vercel.json` once set) had to be explicitly reset via `vercel project update`.
- **The Pools UI has been redone twice** (a modal-based version in v1, then the v2 admin screens). The v2 screens are current; ignore old screenshots or memories of the cog-button modal.
- **`railway config plan`/`apply` are broken on this Windows dev machine** (2026-09-27): `railway@3.11.0`'s own version-compatibility check misreads its executable path when the Railway CLI spawns its IaC evaluator, throwing a misleading "upgrade your CLI" error regardless of actual CLI version — reproduced identically in Git Bash and native PowerShell, so it's not a shell quirk. Worked around by using the Railway MCP's `connect-service-source`/`update-service` (staged) + `get-staged-changes`/`accept-deploy` instead, which hit Railway's API directly and bypass the broken CLI evaluator entirely. Revisit `railway config plan` once Railway ships a fix — it should report no changes needed against the current `.railway/railway.ts`.
