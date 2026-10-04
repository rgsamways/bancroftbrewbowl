## 1. Branch and environment

- [x] 1.1 Create and push a `staging` git branch off current `main`
- [x] 1.2 **Revised approach** (see below): `railway environment new staging --json` created a genuinely empty environment (`7cb1cf45-...`, zero services) — confirmed via `describe-environment` before touching anything further.
- [x] 1.3 Provisioned a fresh Postgres via `railway add --database postgres` scoped to the linked `staging` environment. Verified its service ID (`ab731b4c-...`) and volume ID (`eebc6916-...`) are both different from production's (`131c6d5b-...` / `7fd39364-...`) before proceeding.

**Revised approach note**: the original plan (`railway environment create staging --duplicate production`) did not isolate resources — see the earlier stopped attempt, preserved below. Rebuilt by hand instead: empty environment → fresh Postgres → a new service (`api-staging`, distinct from production's `api`) created from the GitHub repo on the `staging` branch via the Railway MCP's `create-deployment`, then configured with `update-service` (build/start/healthcheck/preDeploy, matching production's `.railway/railway.ts`) and `set-variables` (fresh `BETTER_AUTH_SECRET`, `DATABASE_URL` referencing the new Postgres, `BETTER_AUTH_URL` set to a generated Railway domain). `RESEND_API_KEY`/`RESEND_FROM_EMAIL` deliberately left unset.

## 2. Repoint and clean up

- [x] 2.1 N/A under the revised approach — `api-staging` was created directly on the `staging` branch (`create-deployment` with `branch: "staging"`), no repointing needed. Verified via `list-deployments`.
- [x] 2.2 `RESEND_API_KEY`/`RESEND_FROM_EMAIL` were never set on `api-staging` in the first place (revised approach builds the service from scratch rather than duplicating production's variables) — nothing to clear.

## 3. Verify end to end

- [x] 3.1 Pushed a new commit to `staging` (`d1fc7e3`, empty/verification commit) and confirmed via `railway list-deployments` and `vercel ls` that both a new Railway deployment (on `api-staging`) and a new Vercel Preview deployment fired automatically.
- [x] 3.2 `https://api-staging-staging-05ff.up.railway.app/health` returns `{"ok":true}`. Deploy log confirms `preDeploy` ran (`applying migrations... migrations applied successfully!`) against the fresh, empty staging Postgres — created the full schema from scratch.

## 4. Documentation

- [x] 4.1 Updated `CLAUDE.md`'s "Deploy pipeline" section for local → staging → production.

## Earlier stopped attempt (preserved for the record)

Ran `railway environment create staging --duplicate production --json` first.
The resulting "staging" environment showed the exact same `api` and
`Postgres` service IDs (and the same Postgres volume ID) as production —
not isolated copies. Railway had already started a fresh build of that
shared service under the staging label before this was caught. Deleted the
broken environment immediately (`railway environment delete staging --yes`)
and verified via `describe-service` that production's `api` service was
unaffected (same deployment ID, config, domain, and variables as before).
Not retried with `--duplicate` — rebuilt by hand instead (section 1-4
above). See `project_railway_duplicate_environment_unsafe` in this
project's Claude memory for the persisted finding.
