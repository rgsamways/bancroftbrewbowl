## Why

Last remaining kerfy-parity gap from the earlier comparison: this project
deploys local → production directly, with no environment to catch a bad
change before it's live. Deferred deliberately from `railway-iac-git-deploy`
to keep that change scoped to one risk at a time.

## What Changes

- New `staging` git branch. Pushing to it deploys a separate copy of the
  API on Railway and gets an automatic Vercel preview deployment for the
  dashboard — no custom domain/DNS work for either, to keep this minimal.
- New Railway `staging` environment, created via `railway environment
  create staging --duplicate production` (duplicates the `api` service and
  Postgres with fresh, isolated resources — not shared with production).
- The staging `api` service's source branch repointed to `staging` (not
  `main`), so promoting a change means merging `staging` → `main`, not
  redeploying the same branch twice.
- `RESEND_API_KEY`/`RESEND_FROM_EMAIL` cleared on staging so magic-link
  emails console-log instead of sending real mail from a test environment.
- `CLAUDE.md`'s "Deploy pipeline" section updated to describe a
  local → staging → production flow, matching how `kerfy` is described
  there already.

## Capabilities

### New Capabilities

None — infrastructure/tooling only. `skip_specs: true` is set.

### Modified Capabilities

None.

## Impact

- **Affected**: Railway project (new environment + duplicated services), a
  new `staging` git branch, `CLAUDE.md`.
- **Not affected**: production environment/service — duplication creates
  new resources, it does not modify or read from the production ones.
- **Explicitly deferred**: custom domains for staging (`staging.
  bancroftbrewbowl.ca` / `staging-api.bancroftbrewbowl.ca`) — Railway's
  generated `*.up.railway.app` domain and Vercel's generated preview URL are
  enough to verify a change before promoting it; add real domains later if
  the manual URL lookup becomes annoying in practice.
