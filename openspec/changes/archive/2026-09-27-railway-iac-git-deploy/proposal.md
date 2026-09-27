## Why

Robin is standardizing project tooling across his repos and wants this one
brought in line with `kerfy`'s Railway setup: git-connected deploys (push to
`main` deploys the API automatically, matching how the Vercel dashboard
already works) and migrations that apply automatically at deploy time,
instead of the current fully-manual `railway up --service api` +
`railway ssh ... db:migrate` sequence documented in `docs/HANDOFF.md`. This
is also forced sooner rather than later regardless of that goal: Railway's
"Config as Code" (`railway.json`, what this repo currently uses) is
deprecated and stops being read on 2026-12-01 — Railway's Infrastructure as
Code (`.railway/railway.ts`) is the only supported path forward.

## What Changes

- Migrate `railway.json` to `.railway/railway.ts` (Railway's Infrastructure
  as Code format) for the `api` service, using Railway's own documented
  migration path (`railway config migrate` → `plan` → `apply`), not a
  hand-written file guessed from `kerfy`'s.
- Add `source: github("rgsamways/bancroftbrewbowl")` to the `api` service so
  pushes to `main` deploy it automatically — **BREAKING** in the sense that
  `railway up --service api` stops being how deploys happen; the manual step
  documented in `docs/HANDOFF.md`/`CLAUDE.md` is removed.
- Add an automatic migration step to the API's deploy command (`drizzle-kit
  migrate` before `node dist/index.js`, matching `kerfy`'s `railpack.json`
  pattern) so a schema-changing deploy no longer needs a separate
  `railway ssh ... db:migrate` step.
- Update `CLAUDE.md`'s "Deploy pipeline" section and `docs/BUILD_PLAN.md`'s
  "Infrastructure & deployment" section to describe the new, automatic flow.

## Capabilities

### New Capabilities

None — this is deploy tooling/infrastructure, not application behavior.
`skip_specs: true` is set in this change's `.openspec.yaml`.

### Modified Capabilities

None.

## Impact

- **Affected**: `.railway/railway.ts` (new), `railway.json` (removed),
  `package.json` (add the `railway` npm package, needed locally to
  plan/apply IaC), `CLAUDE.md`, `docs/BUILD_PLAN.md`, `docs/HANDOFF.md`.
- **Explicitly out of scope, deferred to a later change**: a staging
  environment. This change only touches how `production` deploys.
- **Explicitly out of scope, deliberately not touched**: the existing
  Postgres service. It stays unmanaged by IaC in this change — see
  design.md's Decisions for why.
- **Production risk**: this changes how the live API deploys and connects
  Railway to GitHub. The actual `railway config apply` and the GitHub source
  connection are called out in tasks.md as steps that get a plan/diff shown
  and an explicit go-ahead before executing, not folded into the routine
  commit/push/deploy authorization in `CLAUDE.md`.
