## Context

See proposal.md - Why/What Changes. Two structural facts shape this design:

- **`@bbb/shared`'s `package.json` points `main`/`types`/`exports` at
  `./dist/...`**, not source (`docs/BUILD_PLAN.md`'s History section calls
  this load-bearing — it broke production once already). Any command that
  resolves `@bbb/shared` — `tsc` typechecking `apps/api`/`apps/dashboard`, or
  vitest loading `apps/api` modules that import real (not type-only) values
  from `@bbb/shared` — needs `packages/shared/dist` to already exist.
  Nothing currently guarantees that for `pnpm typecheck` or `pnpm test` run
  standalone (only the deploy build commands happen to get this right,
  because they explicitly call `pnpm --filter @bbb/api... build`, whose `...`
  pulls in upstream workspace deps).
- **`apps/api/src/lib/scoring.ts` is Postgres-specific**, not just
  DB-adjacent: it relies on real transactions, a partial unique index
  (`wipeoutEvents`, `WHERE resolved_at IS NULL`), and `onConflictDoUpdate`.
  These are exactly the behaviors worth testing, and none of them survive a
  mock or an in-memory SQLite substitute — the tests need a real Postgres
  instance, both locally and in CI.

## Goals / Non-Goals

**Goals:**
- `pnpm typecheck` and `pnpm test` work correctly every time, run from a
  clean checkout, with no manual "remember to build shared first" step.
- CI (`.github/workflows/ci.yml`) actually passes, using the exact same
  scripts a developer runs locally — not a parallel CI-only path.
- First real test coverage on the app's most consequential, currently-unverified
  logic: survivor elimination/mulligan/double-pick/wipeout scoring, and pick
  'em points derivation.

**Non-Goals:**
- Full coverage of every route — this seeds the pattern with the highest-value
  logic, not a coverage mandate.
- Railway IaC / git-connected deploys / a staging environment — separate,
  later changes (see proposal.md).
- An isolated/ephemeral test database per run, or a testcontainers-style
  setup — deferred; see Risks below for why the simpler path was chosen.

## Decisions

**1. Fix the "`@bbb/shared` must be built first" gap with `pre*` script hooks,
not by restructuring `@bbb/shared`'s exports.**
Add `"build:packages": "pnpm --filter @bbb/shared build"` at the root, plus
`"pretypecheck"` and `"pretest"` scripts that both call `pnpm run
build:packages`. npm/pnpm run any `pre<name>` script automatically before
`<name>` — this is the same pattern already proven in the `noisefloor`
project (`pretest` → `build:packages`), just extended to cover `typecheck`
too, which noisefloor doesn't have. Rejected alternative: pointing
`@bbb/shared`'s `main`/`types` at source instead of `dist` — this is exactly
the setup `docs/BUILD_PLAN.md` says caused a real production outage once
already (`node` has no TS support in production); not touching it.

**2. Per-package `typecheck` scripts mirror `build`'s emit setting.**
`apps/api` and `packages/shared` (`outDir`-based, real emit) get
`"typecheck": "tsc --noEmit"` — matches `kerfy`'s pattern exactly.
`apps/dashboard` (already `noEmit: true` in its `tsconfig.json`) gets
`"typecheck": "tsc -p tsconfig.json"` — no `--noEmit` flag needed since the
tsconfig already sets it; this is just `build`'s first half without the
`vite build` step. Root aggregates via `"typecheck": "pnpm -r run
typecheck"` (pnpm skips packages without the script; no changes needed to
`packages/shared`... it already needs one added too).

**3. Tests run against a real Postgres, using the existing local dev DB
(docker-compose) locally and a fresh service container in CI — not a mock,
not a separate ephemeral instance per run.**
This matches the pattern already established in `kerfy`
(`material-transactions.test.ts` inserts/cleans up against the real dev DB)
and is the only option that actually exercises the Postgres-specific
behavior in `scoring.ts` (see Context). Tests clean up their own rows in
`afterEach`, the same convention `kerfy` uses.
- **Local**: a new `apps/api/src/test/setup.ts` loads `apps/api/.env` via
  `dotenv` (explicit path — the default `dotenv/config` only looks in
  `process.cwd()`, which is the repo root when vitest runs from there, not
  `apps/api/`). Registered as vitest's `setupFiles`. Requires the developer's
  existing local Postgres (`pnpm docker:up`) to be running and migrated — the
  same prerequisite `README`/`HANDOFF.md` already document for `dev:api`.
- **CI**: a `postgres:16-alpine` service container (matching
  `docker-compose.yml`'s image/credentials), with `DATABASE_URL` set at the
  job level and migrations applied (`pnpm --filter @bbb/api db:migrate`)
  before `pnpm test` runs. This is safer than blindly copying `kerfy`'s
  `ci.yml`, which has no service container or `DATABASE_URL` at all despite
  its tests hitting a real DB — that workflow would fail on any DB-touching
  test as written; not propagating that gap here.

**4. CI job order**: checkout → `pnpm/action-setup` → `setup-node` (with pnpm
cache) → `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm typecheck` →
`pnpm --filter @bbb/api db:migrate` (against the service container) →
`pnpm test`. `pnpm typecheck`/`pnpm test` each trigger their own `pre*` hook
to build `@bbb/shared`, so no separate explicit build step is needed in the
workflow — the same hooks that make local `pnpm typecheck`/`pnpm test` work
standalone make CI work too, which is the point of Decision 1.

## Risks / Trade-offs

- **[Risk]** Tests share the real local/CI Postgres instance rather than an
  isolated one → a test that fails to clean up (crashes mid-test, before its
  `afterEach`) leaves stray rows behind. **Mitigation**: none built here
  beyond the `afterEach` convention itself (matching `kerfy`); acceptable for
  a first small batch of tests at this project's scale. Worth revisiting
  (e.g. wrapping each test in a rolled-back transaction) if the test suite
  grows significantly.
- **[Risk]** `apps/api/src/test/setup.ts` assumes `apps/api/.env` exists
  locally (per the existing `README`/`HANDOFF.md` setup instructions). A
  contributor who skips that step gets a connection error, not a clear
  message. **Mitigation**: acceptable — same prerequisite already required
  for `pnpm dev:api`; not a new burden.
- **[Trade-off]** CI's Postgres service adds real setup (a `services:` block,
  migrations-before-test step) that `kerfy`'s `ci.yml` doesn't have. Chosen
  deliberately over copying `kerfy` verbatim — see Decision 3.
