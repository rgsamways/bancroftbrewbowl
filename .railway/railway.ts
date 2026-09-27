import { defineRailway, github, preserve, project, service } from "railway/iac";

// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "api";

export default defineRailway(() => {
  // No rootDirectory — this is a pnpm workspace monorepo, so the build needs
  // the whole repo (root package.json, pnpm-lock.yaml, packages/shared), not
  // just apps/api.
  const api = service("api", {
    source: github("rgsamways/bancroftbrewbowl"),
    build: "corepack enable && pnpm install --frozen-lockfile && pnpm --filter @bbb/api... build",
    start: "pnpm --filter @bbb/api start",
    // Applies pending migrations before the new code starts serving traffic
    // — replaces the old manual `railway ssh ... db:migrate` step. A failing
    // migration blocks the deploy instead of running new code against an
    // unmigrated schema.
    preDeploy: "pnpm --filter @bbb/api db:migrate",
    healthcheck: "/health",
    healthcheckTimeout: 100,
    domains: ["api.bancroftbrewbowl.ca"],
    // Existing secret/config values, already set in Railway — preserve()
    // keeps them as-is rather than reading or rewriting them from here.
    env: {
      BETTER_AUTH_SECRET: preserve(),
      BETTER_AUTH_URL: preserve(),
      COOKIE_DOMAIN: preserve(),
      DASHBOARD_URL: preserve(),
      DATABASE_URL: preserve(),
      RESEND_API_KEY: preserve(),
      RESEND_FROM_EMAIL: preserve(),
    },
  });
  return project("bancroftbrewbowl", {
    resources: [api],
  });
});
