## 1. Branch and environment

- [x] 1.1 Create and push a `staging` git branch off current `main`
- [x] 1.2 Ran `railway environment create staging --duplicate production --json` — **blocked, not verified clean**: the resulting "staging" environment showed the exact same `api` and `Postgres` service IDs (and the same Postgres volume ID) as production, not isolated copies. Railway had already started a fresh build of that shared service under the staging label before this was caught.
- [ ] 1.3 Not reached.

**Stopped here 2026-09-27.** Deleted the broken `staging` environment
immediately (`railway environment delete staging --yes`) rather than
investigate further live against production. Verified afterward via
`describe-service` that production's `api` service was unaffected — same
deployment ID, config, domain, and variables as before. `--duplicate` does
**not** behave as its own `--help` text/examples imply for this project
(possibly specific to this workspace/plan, or to duplicating a service
whose source is `railway.json`-migrated IaC rather than a from-scratch
service — untested which). Needs real investigation (ideally against a
disposable throwaway Railway project, not this one) before retrying:
either figure out why `--duplicate` didn't isolate resources here, or fall
back to `kerfy`'s manual pattern (hand-create a new environment + a
separate Postgres + a separate git-connected service, rather than relying
on duplication). Not resumed this session — flagged to Robin, who chose to
pause rather than keep experimenting live.

## 2. Repoint and clean up

- [ ] 2.1 Repoint the staging `api` service's source branch to `staging` (currently inherits `main` from the duplication) and verify via `describe-service`
- [ ] 2.2 Clear `RESEND_API_KEY` and `RESEND_FROM_EMAIL` on the staging `api` service and verify magic-link sign-in still works there (console-logs the link instead of sending)

## 3. Verify end to end

- [ ] 3.1 Push a trivial commit to `staging` and verify — watched, not assumed — that it deploys the staging Railway environment automatically and a Vercel preview deployment appears for the dashboard
- [ ] 3.2 Hit the staging API's generated `*.up.railway.app` domain's `/health` and confirm 200

## 4. Documentation

- [ ] 4.1 Update `CLAUDE.md`'s "Deploy pipeline" section to describe local → staging → production, matching how `kerfy`'s CLAUDE.md already describes its own flow
