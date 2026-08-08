# Tech Stack

Carried over from the Kerfy monorepo as the baseline for this project (NFL survivor pool).

## Monorepo
- **pnpm** workspaces — `apps/api`, `apps/dashboard`, `packages/shared`
- **TypeScript** across all packages
- **ESLint** + `typescript-eslint` for linting
- **Vitest** for testing

## Backend — `apps/api`
- **Fastify** — HTTP server
- **@fastify/cors** — CORS handling
- **better-auth** — authentication
- **Drizzle ORM** + **drizzle-kit** — DB access/migrations
- **pg** (node-postgres) — PostgreSQL driver
- **zod** — schema validation
- **tsx** — dev runner and one-off scripts
- **dotenv** — env loading

## Frontend — `apps/dashboard`
- **React** + **react-dom**
- **react-router**
- **Vite** (`@vitejs/plugin-react`)
- **Tailwind CSS** (`@tailwindcss/vite`)
- **lucide-react** — icons
- **better-auth** (client-side)

## Shared — `packages/shared`
- Pure TypeScript package, no runtime framework
- **zod** — schemas shared between api/dashboard

## Infrastructure
- **PostgreSQL** via **Docker Compose**

## Runtime
- **Node.js** — executes the API server and all build/dev tooling (pnpm, tsx, Vite, drizzle-kit, vitest, eslint)

## Summary

This stack is a strong fit for a survivor pool: the domain (users, pools, entries, weekly picks, elimination status) is inherently relational, which plays to Postgres + Drizzle's strengths, and better-auth + Fastify + React/Vite covers multi-user accounts and a picks/standings UI with minimal new plumbing.

One gap carried over from the discussion: nothing in this stack currently handles **scheduled jobs** (e.g. locking picks at kickoff). That will need to be added separately — a cron mechanism (in-process scheduler or an external trigger) rather than something Fastify provides out of the box.

Sports data APIs (schedules/live scores) are intentionally **out of scope for now** — picks and lockouts will be handled manually/without live data until that's revisited.
