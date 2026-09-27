## 1. Typecheck scripts

- [x] 1.1 Add `"typecheck": "tsc --noEmit"` to `packages/shared/package.json` and verify `pnpm --filter @bbb/shared run typecheck` exits 0
- [x] 1.2 Add `"typecheck": "tsc --noEmit"` to `apps/api/package.json` and verify `pnpm --filter @bbb/api run typecheck` exits 0 (after `packages/shared` is built)
- [x] 1.3 Add `"typecheck": "tsc -p tsconfig.json"` to `apps/dashboard/package.json` and verify `pnpm --filter @bbb/dashboard run typecheck` exits 0
- [x] 1.4 Add `"build:packages": "pnpm --filter @bbb/shared build"`, `"pretypecheck": "pnpm run build:packages"`, and `"typecheck": "pnpm -r run typecheck"` to the root `package.json`
- [x] 1.5 Verify `pnpm typecheck` run from a clean checkout (delete `packages/shared/dist` first) succeeds without any manual build step

## 2. Test infrastructure

- [x] 2.1 Add root `vitest.config.ts` (`environment: "node"`, `include: ["apps/*/src/**/*.test.ts", "packages/*/src/**/*.test.ts"]`, `setupFiles: ["./apps/api/src/test/setup.ts"]`)
- [x] 2.2 Add `apps/api/src/test/setup.ts` that loads `apps/api/.env` via `dotenv` using an explicit path (not the cwd-relative default) and verify a one-off `console.log(process.env.DATABASE_URL)` inside a throwaway test file confirms it's populated locally
- [x] 2.3 Add `"pretest": "pnpm run build:packages"` to the root `package.json`
- [x] 2.4 Delete the throwaway test file from 2.2 once confirmed

## 3. Scoring tests

- [x] 3.1 With local Postgres up (`pnpm docker:up`, migrated), add `apps/api/src/lib/scoring.test.ts` covering: a losing pick eliminates an entry; a losing pick under `mulligans_allowed` consumes a mulligan instead of eliminating; a double-pick week entry is eliminated as soon as *either* of its two picks loses — even before its other, still-pending pick's game is scored (per `docs/BUILD_PLAN.md`'s documented "eliminated if either loses" behavior; the original draft of this task incorrectly said "only when both lose," corrected here); a wipeout scenario (a result that would eliminate every alive entry) creates a `wipeoutEvents` row instead of eliminating anyone. Verify: `pnpm --filter @bbb/api exec vitest run src/lib/scoring.test.ts` passes, and each test cleans up its own rows in `afterEach`
- [x] 3.2 Add a test for pick 'em points derivation (`computePickEmPoints` in `apps/api/src/routes/entries.ts`): a correct pick scores 1 point, an incorrect pick scores 0, and a tie resolves per `tie_handling` (`void` vs `everyone_correct`). Verify: the new test(s) pass under the same `vitest run` invocation
- [x] 3.3 Verify `pnpm test` run from the repo root picks up both new test files and passes

## 4. CI

- [x] 4.1 Add `.github/workflows/ci.yml`: trigger on push to `main` and on pull requests; steps: checkout, `pnpm/action-setup`, `actions/setup-node` (node 22, pnpm cache), `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`
- [x] 4.2 Add a `postgres:16-alpine` service to the same job (env `POSTGRES_USER=bbb`, `POSTGRES_PASSWORD=bbb`, `POSTGRES_DB=bbb`, port `5432:5432`), a job-level `DATABASE_URL` env pointing at it, a `pnpm --filter @bbb/api db:migrate` step before tests, then `pnpm test`
- [x] 4.3 Push a throwaway branch (or open a draft PR) and verify the workflow runs end to end and goes green — actually confirm in GitHub Actions, not just "should work" (verified: PR #1 on `ci-verify-throwaway`, run 36338613504, all steps including the Postgres-backed migrate + test steps green)
- [x] 4.4 Delete the throwaway branch/PR from 4.3 once confirmed (PR closed, branch deleted; the commit was cherry-picked onto `main` as `907f619` rather than lost)

## 5. Wrap-up

- [x] 5.1 Run `pnpm lint && pnpm typecheck && pnpm test` locally one more time from a clean state and confirm all three pass
- [x] 5.2 Update `docs/BUILD_PLAN.md`'s "Known gaps" bullet about no automated tests existing, since it will no longer be true
