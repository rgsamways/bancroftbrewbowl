import { defineConfig } from "@playwright/test";
import path from "node:path";
import { API_PORT, API_URL, ESPN_STUB_PORT, ESPN_STUB_URL, ROOT, WEB_PORT, WEB_URL, databaseUrl } from "./env";
import { assertLocalDatabase } from "./guard";

// Runs before any server starts or any row is written.
assertLocalDatabase(databaseUrl());

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  outputDir: path.join(ROOT, "e2e-results"),
  workers: 1, // one shared database and one pair of servers
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: path.join(ROOT, "e2e-report") }]] : "list",
  use: {
    baseURL: WEB_URL,
    channel: "chrome", // the installed Chrome; no browser download
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      // A stand-in for ESPN, so the tests never contact the real service.
      command: "node e2e/helpers/espn-stub.mjs",
      cwd: ROOT,
      url: `${ESPN_STUB_URL}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { ESPN_STUB_PORT: String(ESPN_STUB_PORT) },
    },
    {
      command: "pnpm exec tsx src/index.ts",
      cwd: path.join(ROOT, "apps", "api"),
      url: `${API_URL}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: String(API_PORT),
        BETTER_AUTH_URL: API_URL,
        DASHBOARD_URL: WEB_URL,
        DATABASE_URL: databaseUrl() ?? "",
        ESPN_BASE_URL: ESPN_STUB_URL,
      },
    },
    {
      command: `pnpm exec vite --port ${WEB_PORT} --strictPort`,
      cwd: path.join(ROOT, "apps", "dashboard"),
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_URL: API_URL },
    },
  ],
});
