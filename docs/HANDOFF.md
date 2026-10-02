# Session Handoff

> **2026-10-02 update:** Robin has decided on a major v2 (easier, game-like, phone-first front end). Start with `docs/v2/V2_PLAN.md` and the approved mockup in `docs/v2/mockups/`. Nothing is built yet.

_Written 2026-09-27. If you're reading this significantly later, treat the specifics below as a snapshot, not live truth — check git log and the live site first._

## Where things actually stand right now

- Working tree is **clean**, `main` is at `dacd1e7` ("Build straight-up pick 'em: creation, picks, scoring, standings"), and it's already pushed and deployed.
- **Production is live and healthy**: `https://api.bancroftbrewbowl.ca/health` and `https://bancroftbrewbowl.ca` both returned HTTP 200 as of this session. Nothing is broken or half-deployed.
- No uncommitted work, no open branches, no pending migration. There is genuinely nothing "in flight" from the last working session — it ended cleanly after the pick 'em feature shipped.
- It's been about 7 weeks of real-world time since the last session touched this (per the user). Nothing in the repo suggests anyone else touched it in the meantime — verify that assumption is still true before trusting it blindly.

## Read this first

**`docs/BUILD_PLAN.md`** (written alongside this file) is the comprehensive reference — full feature inventory, data model, deployment setup, and known gaps. Read it before making changes; don't rediscover the architecture from scratch.

Also check the persistent memory at `C:\Users\rgsam\.claude\projects\c--dev-bancroftbrewbowl\memory\` (if you're Claude Code resuming this project) — `project_product_direction.md` and `project_scoring_scope.md` carry decisions and reasoning that aren't fully duplicated in the build plan.

## Getting oriented fast

1. `git log --oneline` — 16 commits total, each one is a complete, working, deployed feature (this project was built and shipped incrementally, not in one big batch).
2. The repo is a pnpm workspace: `apps/api` (Fastify), `apps/dashboard` (React/Vite), `packages/shared` (Zod schemas/types shared between them).
3. `apps/api/src/db/schema.ts` is the single source of truth for the data model — read it before touching anything data-related.
4. `apps/api/src/routes/*.ts` — one file per resource area (pools, entries, picks, nfl, promotions, canned-promotions, wipeouts). The endpoint list is in `BUILD_PLAN.md`.

## Local dev setup (if you need to run this locally)

```bash
pnpm install
pnpm docker:up          # starts local Postgres on port 5437 (see docker-compose.yml)
cp .env.example apps/api/.env   # fill in DATABASE_URL etc. per .env.example
pnpm db:migrate          # apply committed migrations to local DB
pnpm dev:api             # http://localhost:3001
pnpm dev:dashboard       # http://localhost:5173
```

Magic-link sign-in works locally without Resend configured — the link just gets printed to the API's console log instead of emailed. To sign in via curl instead of clicking through a real inbox, the token used in the confirmation URL is readable straight out of the `verification` table (`SELECT identifier FROM verification WHERE value = '<email>' ORDER BY created_at DESC LIMIT 1`).

To promote an account to admin locally or in production: `pnpm --filter @bbb/api make-admin <email>` (or `railway ssh --service api -- pnpm --filter @bbb/api make-admin <email>` for production).

## Deploying, if you make changes

- **Both dashboard (Vercel) and API (Railway) are git-connected as of 2026-09-27** — just push to `main`, both auto-deploy. No manual `railway up` step anymore.
- **Schema changes**: `pnpm db:generate` → commit the generated migration file → push. The API's `preDeploy` command applies it automatically before the new code starts serving traffic — no more manual `railway ssh ... db:migrate` step. Still worth calling out a schema-changing push explicitly before doing it, since the migration now runs unattended once pushed.
- Full Railway/Vercel project IDs, service names, and the exact CLI incantations used throughout this build are in the conversation history if you need to re-derive them, but `railway status`/`vercel project ls` from within the repo should relink you to the right linked project quickly since both CLIs were already authenticated and linked here.

## Things that will bite you if you forget them

- **`packages/shared` needs a real build** (`pnpm --filter @bbb/shared build`) before the API or dashboard will run correctly against compiled output — raw TypeScript source is not valid input to plain `node` in production. If a Railway deploy mysteriously can't resolve a `@bbb/shared` import, this is almost certainly why.
- **Don't add a stored "current season" setting.** This was deliberately rejected — see `BUILD_PLAN.md`'s History section. Derive it from actual data every time.
- **`pools.type` is immutable.** Don't add an UPDATE path for it — survivor and pick 'em have incompatible in-flight state (elimination status vs. points) that would corrupt if a pool switched type mid-season.
- **Games are season-scoped, not pool-scoped.** If you're touching anything score-related, remember one `games` row is shared by every pool running that season — don't accidentally scope a query to a single pool where it should span all of them.
- Pin `packageManager` in root `package.json` to a **stable, non-bleeding-edge** pnpm version. Both Railway and Vercel had real build failures earlier in this project tied to pnpm version freshness.

## Plausible next steps (nothing is currently requested — these are just the logical open threads)

None of these are in progress; they're candidates if the user wants to keep building:

1. **Verify the live site still works end-to-end** after the 7-week gap — sign in, check whatever real pools/entries exist in production (this session didn't check, since that needs an authenticated admin session), confirm Resend/domain/DNS are all still in good standing.
2. **Seed/refresh the current NFL season's schedule** if it's stale (`seed-schedule.ts` is safe to re-run any time — it upserts).
3. Close the two dead rules fields (`tiebreaker`, `pick_deadline_rule`) — either implement them for real or consider removing them from the schema if they'll never be used.
4. Any of the explicitly-deferred items in `BUILD_PLAN.md`'s "Known gaps" section, if the user wants them: against-the-spread/confidence pick 'em, referral-bonus promotion, a big-screen standings display.
5. A real test suite — `vitest` is configured but nothing uses it yet.

Don't start any of these unprompted — confirm with the user first, same as every feature in this project so far went through an explicit ask (often with a plan-mode design pass for anything schema-touching) before implementation.
