## Context

See proposal.md for why. Today's checks are two scripts outside the repo. They use `playwright-core` with the installed Chrome, create throwaway users, pools and games directly in the local Postgres (season years in the 2990s), sign in by asking the API for a magic link and reading the one-time token out of the `verification` table, then drive pages at 390 by 844 and clean up after themselves. Vitest at the repo root already tests the API against the real local Postgres on port 5437 (CI uses a Postgres service on 5432 and runs `pnpm --filter @bbb/api db:migrate` before tests). The e2e suite uses that same database.

## Goals / Non-Goals

**Goals:**
- One command runs the whole suite from a clean checkout with Docker Postgres up.
- Impossible to point at production or staging by accident.
- Each test creates its own data and removes it, so runs do not depend on each other or on what is in the dev database.
- A failure shows what the screen looked like (screenshot and trace kept only for failures).

**Non-Goals:**
- Not a full regression suite. Only the main paths named in the proposal.
- No visual or pixel-comparison testing, and no cross-browser or desktop-size testing (phone-first; one Chrome at 390 by 844).
- No tests against the deployed staging or production sites.
- No new test data tooling for the app itself (no seed script shipped to Railway).

## Decisions

**1. `@playwright/test` as the runner, not `playwright-core` plus Vitest.**
It brings a test runner, a `webServer` option that starts and stops the API and Vite for us, retries, screenshots and traces on failure. Alternative: keep `playwright-core` and bolt it onto Vitest. That means hand-rolling server start-up and failure artifacts. The existing Vitest suite is left alone and stays the unit/API suite; the two do not share a runner.

**2. Use the installed Chrome (`channel: "chrome"`), no browser download.**
Matches how the walkthroughs already run, and GitHub's `ubuntu-latest` runners ship Chrome, so CI needs no extra install. Alternative: `playwright install chromium` (large download on every machine and CI run).

**3. The suite starts its own servers on fixed private ports.**
Playwright's `webServer` starts the API on 3011 and Vite on 5183 with `BETTER_AUTH_URL`, `DASHBOARD_URL` and `VITE_API_URL` pointed at each other, and never reuses a server already running on those ports. Alternative: reuse whatever is on 3001/5173. Rejected: those ports are other projects' servers.

**4. A hard guard against non-local databases.**
Global setup reads `DATABASE_URL` (the same `apps/api/.env` the API uses) and aborts unless the host is `localhost`, `127.0.0.1` or the CI service host. This is checked before any server starts or any row is written. It is the safeguard behind the project's rule of never writing test data to production.

**5. Sign in by magic link read from the database, as the walkthroughs do.**
A helper requests the link from the API and fetches the token from `verification.identifier` (better-auth 1.1.9 stores it in plain text), then opens the verify URL in a fresh browser context. This exercises the real session cookie. Alternative: write a session row directly. Rejected: it skips the real sign-in path, which the suite should guard. Because password sign-in (slice 4) will change the sign-in page, the sign-in test checks the magic-link path today and slice 4 extends it.

**6. Per-test data with unique names and a cleanup in `afterEach`/`afterAll`.**
Helpers create users, a pool, games and entries with a run-unique suffix and delete them by those ids. Season years are fixed high numbers (2990 to 2999) so test games never mix with real ones. Alternative: one shared seeded dataset. Rejected: tests would depend on each other's state. Tests run with a single worker because they share one database and one set of servers.

**7. Tests are organised by what a person does, not by file in the app.**
`e2e/frame.spec.ts` (from walk-shell), `e2e/pick-privacy.spec.ts` (from walk-secure), `e2e/sign-in.spec.ts`, `e2e/join-and-pick.spec.ts`, `e2e/standings.spec.ts`, `e2e/admin-results.spec.ts`. Screens that will be rebuilt in slices 6 to 9 are tested by their stable parts (a route loads, the key control exists, the action saves on the server) rather than exact wording, so rebuilding a screen does not mean rewriting its test.

**8. CI runs the suite as a separate step after unit tests.**
It needs the migrated database that the existing CI job already has, plus a `BETTER_AUTH_SECRET` set to a throwaway value in the job's `env`. Failed runs upload the Playwright report as an artifact.

## Risks / Trade-offs

- [Tests get flaky and people stop trusting them] → Wait on specific elements, never fixed sleeps; one retry in CI only; each test owns its data.
- [Screens are rebuilt in slices 6 to 9 and tests break for good reasons] → Test stable behaviour (routes, the server-saved result), and make "update the e2e test for this screen" an explicit task in those slices.
- [A bug in the guard lets tests touch a real database] → The guard has its own unit-style check that it rejects production-style URLs, and it runs before anything else.
- [Port 3011 or 5183 already in use on the machine] → The run fails with a clear message instead of reusing the server.
- [Chrome version differences between this PC and CI] → Only standard Playwright features are used; CI uses the runner's current Chrome.
- [CI cannot be fully proven until it runs on GitHub] → CI runs on pull requests and pushes to `main`, so the first proof is a pull request from `staging`; if it fails, fixing the step is the only follow-up and the app is unaffected.

## Open Questions

- None. (Settled while building: the admin results test drives the Schedule page itself and needs no test-only back door.)
