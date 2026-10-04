## Context

See proposal.md. `railway environment create staging --duplicate production`
is a plain CLI command (a GraphQL mutation), not routed through the broken
`.railway/railway.ts` evaluator that blocked `config plan`/`apply` in the
prior change — confirmed via `railway environment --help`, safe to use
directly.

## Goals / Non-Goals

**Goals:** a staging environment that's genuinely isolated (own Postgres,
own service instances) and deploys from its own branch, so a change can be
verified before it reaches production.

**Non-Goals:** custom domains for staging, CI gating on the staging
deploy, or replicating kerfy's multi-tenant control-plane/sandbox topology
— that complexity is specific to kerfy's product, not this app.

## Decisions

**1. ~~Duplicate, don't hand-build~~ Revised: hand-build, not duplicate.**
The original plan was `--duplicate production`, expecting it to clone the
`api` service and Postgres with fresh, isolated resources in one step.
Tried it first — it did not isolate anything; the resulting environment
showed the exact same service and volume IDs as production (see tasks.md's
"Earlier stopped attempt"). Deleted immediately, verified production
unaffected, then built staging by hand instead: a genuinely empty
environment (verified via `describe-environment` before adding anything),
a fresh `Postgres` service (`railway add --database postgres`, verified
different volume ID), and a new `api-staging` service created straight
from the GitHub repo on the `staging` branch — more steps, but every one
independently verified rather than trusted from a single command's success
message.

**2. Repoint the duplicated `api` service's source branch to `staging`
immediately after duplication**, since it inherits `main` from production
by default. Otherwise both environments would deploy from the same branch,
defeating the purpose.

**3. Clear `RESEND_API_KEY`/`RESEND_FROM_EMAIL` on the staging service**
after duplication. The app already falls back to console-logging
magic-link/change-email links when that var is unset (existing behavior,
not new) — the right default for a non-production environment that
shouldn't send real mail or spend the real Resend quota.

**4. No custom domains.** Railway's generated `*.up.railway.app` domain for
the staging API and Vercel's generated preview URL for a `staging` branch
push are both automatic and sufficient to click through and verify a
change. Revisit only if the generated-URL lookup becomes a real annoyance.

## Risks / Trade-offs

- **[Risk]** Environment duplication copies current variable *values*,
  including `BETTER_AUTH_SECRET` and `DATABASE_URL` — staging temporarily
  shares production's auth secret and, if not repointed, could point at
  production's actual Postgres. **Mitigation**: duplication provisions a
  **new** Postgres instance for staging (not a copy of the connection
  string to the same database) — verify this explicitly after duplicating,
  don't assume it.
