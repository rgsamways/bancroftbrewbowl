## Why

Every v2 slice goes live the moment it is built, with no private review step. Today the only real-browser checks are throwaway scripts in `C:\tmp` that live outside the repo, so a later slice can quietly break sign-in, the pick screen or the tab bar and nobody finds out until a player does. These checks need to live in the repo and run with one command.

## What Changes

- Add a small suite of real-browser tests (Playwright, driving Chrome at a phone size of 390 by 844) that guard the main screens: sign in, the app frame and tabs for each kind of user, joining a pool, making a pick, standings, and an admin entering results.
- Promote the two existing walkthroughs (`walk-shell.mjs` for the frame, `walk-secure.mjs` for pick privacy) into this suite instead of rewriting them from scratch.
- Add one command, `pnpm test:e2e`, that starts a local API and the dashboard on their own ports, runs the tests, and cleans up the data they created.
- Add a safety check so the suite refuses to run unless the database is local. It must never be able to write to production or staging.
- Add the suite to CI as its own step, so a broken screen fails the build.
- No change to the app itself: no API, schema or screen changes.

## Capabilities

### New Capabilities

None. This is test tooling; it changes no behaviour of the app. The change declares `skip_specs: true`.

### Modified Capabilities

None.

## Impact

- New dev dependency `@playwright/test` at the repo root, using the Chrome already installed (no browser download). Dev only; nothing ships to Vercel or Railway.
- New folder `e2e/` (config, helpers, test files). New scripts in the root `package.json`. One new step in `.github/workflows/ci.yml`.
- Uses ports 3011 (API) and 5183 (dashboard) only. Ports 3001 and 5173 belong to other projects and are never touched.
- Later slices add or update a test in `e2e/` as part of their own "verified" step; `docs/HANDOFF.md` and the build plan say so.
