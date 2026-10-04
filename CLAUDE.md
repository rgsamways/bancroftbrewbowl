# Bancroft Brew Bowl — project instructions

## OpenSpec workflow (required, not optional)

This project uses OpenSpec (CLI, spec-driven schema, `openspec/` at repo root)
for all non-trivial development, matching how Robin runs other projects
(kerfy, noisefloor, vocare, etc.) — don't treat it as optional ceremony, and
don't quietly fall back to freehand edits + hand-rolled markdown just because
a task feels well-understood already.

**Before starting any non-trivial change** (new feature, schema change,
permission/behavior change, anything touching more than a couple of files) —
create or update a real OpenSpec change first, using the installed skills
(`.claude/skills/openspec-*`), not hand-written files imitating their shape:

- **New work**: `openspec-propose` — scaffolds `proposal.md`, `design.md`,
  `specs/<capability>/spec.md`, and `tasks.md` together via the CLI.
- **Revising an in-flight change's plan**: `openspec-update-change`.
- **Implementing**: `openspec-apply-change` — works through `tasks.md`,
  checking items off as they're actually verified (not just written).
- **Thinking something through before committing to a change**:
  `openspec-explore` — read-only investigation and design discussion; never
  writes code.
- **Finishing a change**: `openspec-sync-specs` to merge its delta specs into
  the main specs, then `openspec-archive-change` once implementation and
  verification are both complete.

Use `openspec list --json` / `openspec status --change <name> --json` to check
real state before assuming what's done — don't rely on memory of a prior
session's summary, which can drift from what's actually in `tasks.md`.

**Small, truly mechanical fixes** (a typo, a one-line bug fix, a config value)
don't need a proposal — use judgment. Default to "yes, this needs a change"
for anything touching schema, routes, permissions, or user-facing behavior.
Schema-touching changes have historically gone through a plan-mode design
pass here even before OpenSpec was installed — keep doing that within the
`openspec-propose` step, not instead of it.

**`openspec/ROADMAP.md`** is the living, cross-change tracker — the
big-picture "where do things actually stand across every change" view Robin
reads to follow along. Keep it current whenever a change's status changes,
not only when asked directly.

## Read before making changes

`docs/BUILD_PLAN.md` is the comprehensive architecture/feature/data-model
reference; `docs/HANDOFF.md` is the latest session snapshot. Read both before
touching anything non-trivial — don't rediscover the architecture from
scratch. Persistent cross-session memory also exists at
`C:\Users\rgsam\.claude\projects\c--dev-bancroftbrewbowl\memory\`.

## Deploy pipeline (automatic, not a per-change ask)

**Local → staging → production** (staging added 2026-09-27; see
`openspec/changes/archive/2026-09-27-staging-environment`). Push to
`staging` first to verify a change on its own isolated API service +
Postgres + a Vercel preview deployment, then merge `staging` → `main` to
promote it. Once a change's tasks are implemented and verified (typecheck/
build passes, and manually confirmed where practical), **archive it, commit,
push, and deploy as the normal last step — don't stop to ask permission for
commit/push/deploy on this repo specifically; that's pre-authorized here.**
Still surface what you're about to do before doing it, and stop and ask
first for anything actually destructive (force-push, `railway`/`vercel`
resource deletion, schema rollback) — the pre-authorization covers the
routine finish-a-change sequence only, not those.

- **Staging**: Railway environment `staging`, service `api-staging`
  (deploys from the `staging` branch, generated domain
  `api-staging-staging-05ff.up.railway.app`), its own Postgres (`Postgres-
  sjmD` in that environment — a genuinely separate database/volume from
  production's, not a copy), and Vercel's automatic Preview deployment for
  the `staging` branch (URL changes per-commit; check `vercel ls
  bancroftbrewbowl --meta gitBranch=staging` for the current one).
  `RESEND_API_KEY`/`RESEND_FROM_EMAIL` are deliberately unset there, so
  magic-link/change-email links console-log instead of sending real mail.
  **Do not use `railway environment create --duplicate` to touch this
  again** — tried it once, it aliased the new environment's services to
  production's exact service/volume IDs instead of isolating them; see
  `project_railway_duplicate_environment_unsafe` in this project's Claude
  memory. Rebuild by hand (empty environment → `railway add --database
  postgres` → `create-deployment` from the repo/branch → `update-service`/
  `set-variables`) and verify IDs differ from production before trusting
  it, if this needs to be recreated.

- **Both dashboard (Vercel) and API (Railway) are git-connected** — pushing
  to `main` deploys both automatically. `railway up`/`railway ssh ...
  db:migrate` are no longer part of the routine flow (migrated 2026-09-27;
  see `openspec/changes/archive/2026-09-27-railway-iac-git-deploy`). Confirm
  a deploy actually fired with `vercel project ls` (dashboard) or `railway
  status` / the Railway MCP's `list-deployments` (API) if you want to
  double-check.
- **Schema changes**: `pnpm db:generate` → commit the migration → push. The
  API's `preDeploy` step (`.railway/railway.ts`) now runs `pnpm --filter
  @bbb/api db:migrate` automatically before each deploy starts serving
  traffic — no separate manual migrate step. A failing migration blocks
  that deploy rather than running new code against an unmigrated schema.
  Still call out a schema-changing push explicitly before doing it, even
  though the rest of the pipeline is pre-authorized — the migration itself
  runs unattended once pushed, so there's no manual gate left to catch a bad
  one before it hits production.
- Railway's Infrastructure as Code (`.railway/railway.ts`, not the old
  `railway.json`) manages the `api` service's build/start/healthcheck/
  preDeploy/source settings and the `env` block (`preserve()`d values —
  never inline a real secret there). It deliberately does **not** manage
  the Postgres service — see that change's design.md for why. `railway
  config plan`/`apply` are broken in this Windows dev environment (traced to
  a real bug in `railway@3.11.0`'s version check, not a real version
  mismatch) — use the Railway MCP's `connect-service-source` /
  `update-service` (both support `staged: true`) plus `get-staged-changes`
  and `accept-deploy` instead when this file needs to change again, until
  that's fixed upstream.

## Pace

Don't start any of the deferred/open-thread items in `docs/HANDOFF.md`
unprompted — every feature in this project so far went through an explicit
ask, often with a plan-mode design pass for schema-touching work, before
implementation.
