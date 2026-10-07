# Setting up a new client

This app is a **template redeployed per client** — every bar/brewery that
wants their own pool-keeping site gets its own copy of this exact codebase,
its own Railway project, its own Vercel project, and its own domain. There
is no shared/multi-tenant infrastructure and there never should be (see
`docs/BUILD_PLAN.md`'s "Product direction"). This is the checklist for
standing up client #2 (and beyond) without re-deriving every step from
scratch the way client #1 (Bancroft Brewing Co.) was.

## 1. Fork the repo

Fork/clone `rgsamways/bancroftbrewbowl` into a new GitHub repo for the
client. Keep the codebase identical — customization happens through config
and a small number of branding files (step 6), not by forking the logic.

## 2. Railway (API + Postgres)

1. Create a new Railway project.
2. Add a Postgres service (`railway add --database postgres`).
3. Create the API service from the new repo (`railway add --repo
   <owner>/<new-repo> --branch main --service api`), or use
   `mcp__railway__create-deployment`.
4. Configure the service — copy `.railway/railway.ts` from this repo as the
   starting point, then change:
   - `github("rgsamways/bancroftbrewbowl")` → the new repo
   - `domains: ["api.bancroftbrewbowl.ca"]` → the new client's API domain
   - Everything else (`build`, `start`, `preDeploy`, `healthcheck`) stays
     the same — it's not client-specific.
5. Set variables (see `.env.example` for the full list; `OPERATOR_EMAILS` is the owner's address, the site's god-user):
   `DATABASE_URL` (reference `${{Postgres.DATABASE_URL}}`),
   `BETTER_AUTH_SECRET` (generate a **new** random one — never reuse
   another client's), `BETTER_AUTH_URL`, `DASHBOARD_URL`, `COOKIE_DOMAIN`,
   `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
6. Run `railway config plan`/`apply` once Railway's Windows IaC bug (see
   `docs/BUILD_PLAN.md`'s History) is fixed, or use the Railway MCP's
   `update-service`/`set-variables` directly as this project's own setup
   ended up doing.

## 3. Vercel (dashboard)

1. Create a new Vercel project from the new repo. `vercel.json` at the repo
   root already has the right build/install/output settings — nothing to
   change there.
2. Add the client's dashboard domain.
3. Set `VITE_API_URL` to the new Railway API domain.

## 4. DNS (Cloudflare, or whatever the client's registrar is)

Point the dashboard and API subdomains at Vercel/Railway respectively, DNS
only / grey-cloud (not proxied) so each platform can issue its own TLS
certificate — see `docs/BUILD_PLAN.md`'s History for why this matters.

## 5. First-run setup

1. `railway ssh --service api -- pnpm --filter @bbb/api db:migrate` —
   actually not needed anymore: the `preDeploy` step runs this
   automatically on the service's first deploy.
2. `railway ssh --service api -- pnpm --filter @bbb/api make-admin
   <client's email>` — promote the client (or yourself, for setup) to
   admin.
3. `railway ssh --service api -- pnpm --filter @bbb/api seed-schedule
   <season year>` — import the season's NFL schedule from ESPN.
4. Sign in (an emailed link, or set a password on the Me page), create the
   client's first pool from **Pools > New pool**, and confirm the full pick
   flow works end to end before handing it off.
5. Fill in the content through the admin screens (nothing is seeded): the
   drink and food menu (**Menu**), live music (**Menu > Music**), and the
   From the brewery posts (**More > From the brewery**). Optionally set the
   pool total in the pool's Settings. Print the table card (**More > Table
   card**) for the tables.
6. Check the wording with the client: "You must be 19 or older to play." and
   "Please drink responsibly." are in the app, and the menu and promotion
   copy should be checked with the client (and the local liquor regulator)
   before it goes live. No offer is linked to winning.

## 6. Branding

Not database-driven yet — a real code change per client, kept deliberately
small:
- `apps/dashboard/src/index.css` — the Tailwind v4 `@theme` block (colors,
  fonts). This is the one place client-specific branding actually lives in
  code today.
- `pools.logoUrl` / `primaryColor` / `secondaryColor` (per-pool, set via the
  admin UI) — exist in the schema for this purpose but aren't yet wired
  into the dashboard's rendering. Wiring them up would remove the need to
  touch `index.css` per client — worth doing once there's a second real
  client, not before (see `docs/BUILD_PLAN.md`'s Known gaps).

## What's still genuinely manual here

Every step above is a real action against a real Railway/Vercel/DNS
account, not something scriptable end-to-end without those accounts'
credentials in hand. This doc turns "re-derive the whole setup from memory
or old conversation history" into "follow a checklist" — it does not turn
"one command creates a new client." That's the honest state of it; revisit
if/when there's a third client and the manual steps above are still
error-prone.

## Helping someone who is locked out

Players can sign in with an emailed link or, if they set one on the Me page, a
password. There is no "forgot password" email: someone who forgot their password
signs in with a link. If they cannot get email either, reset it for them:

```
NEW_PASSWORD='a new long password' railway ssh --service api -- pnpm --filter @bbb/api reset-password <their email>
```

The password must be 10 to 127 characters. The command also signs them out
everywhere, and tells you if there is no account for that email. Give them the
password privately and ask them to change it on the Me page.
