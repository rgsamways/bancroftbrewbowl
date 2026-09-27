## Why

This project has no automated way to catch a broken build, a type error, or a
regression before it reaches production — no CI, no real typecheck scripts,
and zero test files despite `vitest` already being wired into the root
`test` script. Robin is standardizing tooling across projects (kerfy,
noisefloor, etc.) and wants this repo brought in line with kerfy's baseline,
starting with the safe, additive pieces before touching the deploy pipeline
itself (Railway IaC / git-connected deploys / a staging environment are
separate, later changes — explicitly out of scope here).

## What Changes

- Add a real `typecheck` script to `apps/api`, `apps/dashboard`, and
  `packages/shared` (`tsc --noEmit` / `tsc -p tsconfig.json --noEmit` as
  appropriate per package), aggregated at the root via
  `"typecheck": "pnpm -r run typecheck"` — matching kerfy's setup.
- Add a root `vitest.config.ts` (`environment: "node"`, `include:
  ["apps/*/src/**/*.test.ts", "packages/*/src/**/*.test.ts"]`), matching
  kerfy's config, so the root `test` script actually has somewhere to look.
- Add a first real batch of unit tests for `apps/api`, targeting the most
  consequential, currently-uncovered logic per `docs/BUILD_PLAN.md`: survivor
  elimination/mulligan/double-pick/wipeout scoring and pick 'em points
  derivation (`apps/api/src/lib/scoring.ts`,
  `apps/api/src/routes/entries.ts`'s `computePickEmPoints`).
- Add `.github/workflows/ci.yml` running `pnpm lint`, `pnpm typecheck`, and
  `pnpm test` on push to `main` and on pull requests, mirroring kerfy's
  workflow (checkout, `pnpm/action-setup`, `setup-node` with pnpm cache,
  `pnpm install --frozen-lockfile`, then the three checks).

## Capabilities

### New Capabilities

None — this is tooling/process only; it does not change any spec-level
behavior of the survivor or pick 'em pool apps. `skip_specs: true` is set in
this change's `.openspec.yaml`.

### Modified Capabilities

None.

## Impact

- **Affected files**: root `package.json`, `apps/api/package.json`,
  `apps/dashboard/package.json`, `packages/shared/package.json`, a new root
  `vitest.config.ts`, new `apps/api/src/lib/scoring.test.ts` (and possibly a
  second test file for `computePickEmPoints`), new
  `.github/workflows/ci.yml`.
- **No production runtime impact** — nothing here touches deployed code
  paths, only local/CI tooling. No deploy is needed for this change beyond
  the dashboard's normal auto-deploy on push (which will simply rebuild the
  same app).
- **Dependencies**: none new — `vitest` is already a root devDependency;
  `pnpm/action-setup` and `actions/setup-node` are standard GitHub Actions,
  no new npm packages required.
