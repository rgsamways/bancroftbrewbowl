## Context

See proposal.md - Why/What Changes. Verified against the live project (via
Railway's MCP tools and CLI, not assumption) before designing this:

- The `api` service's variables are: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  `COOKIE_DOMAIN`, `DASHBOARD_URL`, `DATABASE_URL`, `RESEND_API_KEY`,
  `RESEND_FROM_EMAIL`. It has a custom domain (`api.bancroftbrewbowl.ca`) and
  a generated Railway domain. Its build is already on Railway's Railpack
  builder under the hood (`buildEnvironment: V3`, `builder: RAILPACK`) —
  `railway.json`'s `"builder": "NIXPACKS"` is apparently already stale/ignored
  by the platform; only its `buildCommand`/`startCommand`/`healthcheckPath`
  are what's actually load-bearing today.
- Postgres is a separate, plain Railway-managed database service (image
  `ghcr.io/railwayapp-templates/postgres-ssl:18`), never managed by
  `railway.json` or any IaC file. It is **not** touched by this change (see
  Decisions).
- Railway's official migration path is `railway config migrate` → `plan`
  (read-only, shows the exact diff) → `apply`. `railway config migrate
  --service api` (dry-run by default) writes a named-partial file
  (`export const partial = "api"`) because Config as Code was per-service —
  confirmed by running the dry-run command against this project.
- `railway.json`/`railway.toml` are deprecated and stop being read on
  **2026-12-01** — this migration isn't optional long-term regardless of the
  git-connect/auto-migrate goals.

## Goals / Non-Goals

**Goals:**
- The `api` service deploys automatically on push to `main`, same as the
  Vercel dashboard already does — no more `railway up --service api`.
- Schema migrations apply automatically as part of that deploy — no more
  separate `railway ssh ... db:migrate` step.
- Zero disruption to the live service: no dropped env vars, no lost custom
  domain, no accidental new/duplicate resources.

**Non-Goals:**
- A staging environment — separate, later change.
- Bringing Postgres itself under IaC management — deliberately deferred
  (see Decisions).
- Changing anything about the Vercel/dashboard side, which is already
  git-connected.

## Decisions

**1. Leave the existing Postgres service unmanaged by IaC — use a named
partial (`export const partial = "api"`), not a whole-project file.**
Railway's ownership rule for named partials: "A named partial only deletes
resources it owns. Resources owned by other partials, **or not yet owned by
any partial**, are left alone when they're missing from your file." Postgres
has never been owned by any IaC partial (it predates IaC), so omitting it
from an `api`-partial file is safe by design, not just by omission — this is
exactly the behavior `railway config migrate --service api` produces by
default (confirmed: it emits a named `partial` export for a single-service
migration). Rejected alternative: declaring `postgres("Postgres")` in the
file to reference `db.env.DATABASE_URL` the way `kerfy`'s example does —
rejected because it's unverified whether `postgres()` adopts an existing
same-named database or attempts to create a new one, and this project's
Postgres already holds real production data. Not worth the risk for a
cosmetic env-var-reference improvement; `preserve()` (below) achieves the
same outcome without the ambiguity.
**Only a whole-project (non-partial) file's "omit = delete" rule would make
this dangerous** — confirmed we're not using that mode.

**2. Preserve all seven existing env vars with `preserve()`, don't inline
any of them.** `preserve()` means "keep the value already set in Railway" —
the CLI never reads or rewrites the actual secret values. This is the same
approach `kerfy` uses for its sealed `BETTER_AUTH_SECRET`, generalized to
every var here since none of their live values are known to this session
and none need to change.

**3. Explicitly declare the custom domain** (`domains:
["api.bancroftbrewbowl.ca"]`) **rather than omitting it and hoping it's
left alone.** The IaC reference document's domain section doesn't state
omission-is-safe the way the partial-ownership section does for whole
services/databases, so this is declared explicitly to remove the ambiguity
entirely rather than rely on an inference. The generated Railway
`*.up.railway.app` domain is never declared, per the same reference doc
("Generated Railway service domains are not included in
`.railway/railway.ts`").

**4. Use `preDeploy` for the migration step, not `kerfy`'s pattern of
chaining it into `start`.** Railway IaC has a first-class `preDeploy` field
("Run a command, such as a database migration, between the build and the
deploy... a failing command stops the deployment") — cleaner and safer than
kerfy's `startCommand: "... && node dist/index.js"` string-chaining, and a
failed migration correctly blocks the deploy instead of possibly running
the old code anyway. Value: `pnpm --filter @bbb/api db:migrate` (the
existing script), not a raw `drizzle-kit migrate` invocation, to reuse
whatever that script already does.

**5. `source: github("rgsamways/bancroftbrewbowl")`, no `rootDirectory`.**
Matches `kerfy`'s own choice for the same reason: this is a pnpm workspace
monorepo, and the build command (`pnpm --filter @bbb/api... build`) needs
the whole repo checked out, not just `apps/api`.

**6. Treat `railway config apply` and the GitHub source connection as a
hard stop for explicit confirmation, not part of the routine pre-authorized
commit/push/deploy pipeline in `CLAUDE.md`.** Everything up to and including
`railway config plan` is read-only/local-file-only and safe to just do. The
plan's output gets shown in full before `apply` runs.

## Risks / Trade-offs

- **[Risk]** `railway config apply` is rejected if the live environment
  changed since the plan was taken (a documented safety feature — "the apply
  is rejected and you are asked to run `railway config plan` again"), so a
  concurrent dashboard edit during this change would just require re-running
  plan, not corrupt anything.
- **[Risk]** Switching to git-connected deploys changes *when* deploys
  happen — a push to `main` now deploys immediately, with no manual
  `railway up` gate to hold a change back. **Mitigation**: this matches how
  Vercel already behaves for the dashboard; the project has no staging
  environment yet to soften this either way (tracked as the next, separate
  change).
- **[Trade-off]** Not bringing Postgres under IaC means `.railway/railway.ts`
  doesn't fully describe the project's infrastructure — a future reader has
  to know Postgres exists and is managed elsewhere. Accepted for now; revisit
  once `postgres()`'s adoption-vs-create behavior against an existing
  same-named database is verified (e.g. in a disposable test project) rather
  than assumed.
