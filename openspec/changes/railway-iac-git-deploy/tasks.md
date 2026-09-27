## 1. Local setup

- [x] 1.1 Add `railway` as a root devDependency (`pnpm add -D railway`) and verify `pnpm install` succeeds
- [x] 1.2 Run `railway config migrate --service api` (dry-run, no `--apply`) and verify the output uses `export const partial = "api"` and translates the current `railway.json`'s `buildCommand`/`startCommand`/`healthcheckPath`/`healthcheckTimeout` correctly

## 2. Author the IaC file

- [x] 2.1 Run `railway config migrate --service api --apply` to write `.railway/railway.ts` for real and clear the Railway-side Config-as-Code setting for the `api` service
- [x] 2.2 Edit `.railway/railway.ts`: add `source: github("rgsamways/bancroftbrewbowl")` (no `rootDirectory`), `domains: ["api.bancroftbrewbowl.ca"]`, `preDeploy: "pnpm --filter @bbb/api db:migrate"`, and an `env` block with all seven existing vars (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `COOKIE_DOMAIN`, `DASHBOARD_URL`, `DATABASE_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`) each set to `preserve()`
- [x] 2.3 Delete `railway.json`. **Deviation**: `railway config plan` could not be used to verify this — see note below.

## 3. Plan, review, and apply (production-risk checkpoint)

**Deviation from the original plan**: `railway config plan`/`apply` are broken
in this environment — both the CLI's native IaC evaluator and the `--runner`
fallback to the SDK's own `railway-iac-ts` throw `This version of railway/iac
requires Railway CLI 5.42.1 or newer` unconditionally, even against CLI
5.62.1 (traced to `assertMinimumIacCliVersion()` in `railway@3.11.0`
misreading its own executable path on this Windows setup — not a real
version mismatch; confirmed identical failure in both Git Bash and native
PowerShell). Reported to Robin as a blocker rather than worked around by
patching `node_modules`. Achieved the same goal instead via the Railway MCP
tools directly (`connect-service-source` + `update-service`, both
`staged: true`), which stage a reviewable diff without going through the
broken CLI path at all. `.railway/railway.ts` stays in the repo as accurate
documentation of the desired state; a future `railway config plan`, once
Railway ships a fix, should report no changes needed.

- [x] 3.1 ~~Run `railway config plan`~~ Reviewed the equivalent staged diff via the Railway MCP's `get-staged-changes`: 7 additions on the `api` service only (source repo/branch, build/start/healthcheck/preDeploy commands), `destructive: false`, zero changes to variables, the domain, or Postgres
- [x] 3.2 Showed the full diff table to Robin and got an explicit go-ahead before committing
- [x] 3.3 Committed via the MCP `accept-deploy` tool (the staged-changes equivalent of `apply`) — completed without error, `deploymentStatus: "triggered"`
- [x] 3.4 Verified via `describe-service`: source is now `rgsamways/bancroftbrewbowl`@`main`, domain and all 7 variables unchanged, deployment status `SUCCESS`

## 4. Verify auto-deploy and auto-migrate actually work

- [ ] 4.1 Push a trivial, real commit to `main` (the wrap-up commit from this change is fine) and verify — actually watch it happen, not just "should work" — that a new Railway deployment starts **without** running `railway up`
- [ ] 4.2 Verify the deploy's build log shows the `preDeploy` migration step running (`pnpm --filter @bbb/api db:migrate`) before the server starts, and that `/health` returns 200 afterward
- [ ] 4.3 Confirm `api.bancroftbrewbowl.ca` and all seven env vars still resolve correctly post-deploy (a quick authenticated smoke check or `/health` plus a spot-check of one var-dependent behavior, e.g. that magic-link email sending config is intact)

## 5. Documentation

- [ ] 5.1 Update `CLAUDE.md`'s "Deploy pipeline" section: remove the manual `railway up --service api` step for code changes; keep calling out that a schema change still needs `pnpm db:generate` + committing the migration (the `preDeploy` step applies it automatically now, so `railway ssh ... db:migrate` is no longer needed either — update that too)
- [ ] 5.2 Update `docs/BUILD_PLAN.md`'s "Infrastructure & deployment" section and `docs/HANDOFF.md`'s "Deploying, if you make changes" section to match the new automatic flow
- [ ] 5.3 Remove `railway.json` from git tracking if not already handled by task 2.3's deletion (verify `git status` shows it gone, not just deleted-on-disk)
