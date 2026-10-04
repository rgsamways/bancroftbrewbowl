# Bancroft Brew Bowl

A phone-first NFL survivor and pick 'em pool for Bancroft Brewing Co. (bancroftbrewbowl.ca), with the brewery's menu, live music and posts alongside. Built as a template that is redeployed per client, not a shared multi-tenant service.

- **Stack:** pnpm monorepo. `apps/api` (Fastify, Drizzle, Postgres, better-auth), `apps/dashboard` (React, Vite, Tailwind v4), `packages/shared` (types and rules, built with `tsc`).
- **Run locally:** `pnpm install && pnpm docker:up && cp .env.example apps/api/.env && pnpm db:migrate && pnpm dev:api && pnpm dev:dashboard` (API on 3001, dashboard on 5173, Postgres on 5437).
- **Check:** `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:e2e`, `pnpm test`, `pnpm test:e2e`.
- **Deploy:** pushing to `main` deploys the dashboard (Vercel) and the API (Railway); migrations run before each deploy. `staging` is the safe place to try a change first.

## Where things are written down

- `docs/HANDOFF.md`: the latest session snapshot and what is next.
- `docs/BUILD_PLAN.md`: architecture, data model and features.
- `docs/v2/V2_BUILD_PLAN.md` and `docs/v2/mockups/`: the v2 plan and the clickable mockups.
- `docs/ROLES_AND_RULES.md`: who can do what.
- `docs/NEW_CLIENT_SETUP.md`: standing up a new client; also how to help someone who is locked out.
- `docs/IDEAS.md`: parked ideas.
- `openspec/`: the change history (`changes/archive/`), the current behaviour specs (`specs/`) and `ROADMAP.md`. `CLAUDE.md` has the working rules.
