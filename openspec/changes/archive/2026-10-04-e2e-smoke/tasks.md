## 1. Setup and safety

- [x] 1.1 Add `@playwright/test` as a root dev dependency, add `pnpm test:e2e` to the root `package.json`, and create `e2e/playwright.config.ts` (Chrome channel, 390 by 844, single worker, screenshot and trace only on failure, `webServer` for the API on 3011 and Vite on 5183 that never reuses existing servers). Verify with `pnpm test:e2e` running an empty spec and exiting cleanly with both servers stopped afterwards.
- [x] 1.2 Write the database guard in global setup (aborts unless the host is local) with a small Vitest test covering production-style, staging-style and local URLs. Verify the Vitest test passes and that `DATABASE_URL` pointed at a non-local host makes `pnpm test:e2e` stop before starting any server.
- [x] 1.3 Add `.gitignore` entries for Playwright output folders. Verify `git status` is clean after a run.

## 2. Helpers

- [x] 2.1 Write `e2e/helpers/db.ts` (connect, create user, pool, games, entries with run-unique names, delete everything it created). Verify with a spec that creates and removes data and leaves the row counts as they were.
- [x] 2.2 Write `e2e/helpers/auth.ts` (request a magic link, read the token from `verification`, open the verify URL in a fresh context, return a signed-in page) and `e2e/helpers/api.ts` (call the API from inside a signed-in page with the real session cookie). Verify with a spec that signs in as a new user and sees the app header.

## 3. Promote the existing walkthroughs

- [x] 3.1 Convert `walk-shell.mjs` into `e2e/frame.spec.ts`: tabs per kind of user (no pools, one pool, several pools, only eliminated, admin, non-admin), Pick and Standings redirects and lists, Me page and Sign out, no sideways scrolling on each frame screen, 44 px tap sizes, Inter font and background colour. Verify all converted checks pass against the local stack and that deliberately removing the Admin tab for admins makes the spec fail.
- [x] 3.2 Convert `walk-secure.mjs` into `e2e/pick-privacy.spec.ts`: only your own name links to a pick screen, someone else's pick screen is refused, your own pick saves, other players' unlocked picks and emails are not exposed, changing or deleting another player's pick is refused for players and for admins, the admin picks table shows "Picked" for others. Verify all pass and that a deliberately weakened check on the server side is caught.

## 4. New main-path tests

- [x] 4.1 Write `e2e/sign-in.spec.ts`: the public sign-in page shows the email field and the send-link button, a link request succeeds, the emailed-link path signs the user in, and Sign out returns to the sign-in page. Verify it passes locally.
- [x] 4.2 Write `e2e/join-and-pick.spec.ts`: a new user joins a pool with the current join screen, then reaches the pick screen from the Pick tab, picks a team, and the pick is saved on the server. Verify it passes and the created data is gone afterwards.
- [x] 4.3 Write `e2e/standings.spec.ts`: the standings page shows alive and eliminated players for a seeded pool and the player's own entry is marked. Verify it passes.

## 5. Admin results

- [x] 5.1 Read the current admin results screen and settle the open question in design.md (drive it through the screen, or finish games another way). Write `e2e/admin-results.spec.ts`: an admin enters a game result and standings change as expected. Verify it passes and a non-admin cannot reach the same action.

## 6. CI and docs

- [x] 6.1 Add an e2e step to `.github/workflows/ci.yml` (after unit tests, throwaway `BETTER_AUTH_SECRET`, upload the Playwright report when it fails). Verify by opening a pull request from `staging` and seeing the step pass; if CI cannot be exercised before release, record that plainly in this task. _(proved: PR #2 ran the step in GitHub CI, 25 passed)_
- [x] 6.2 Update `docs/HANDOFF.md` (how to run `pnpm test:e2e`, what the guard does, retire the old local walkthrough recipe), `docs/v2/V2_BUILD_PLAN.md` (each later slice updates its e2e test as part of "verified") and `openspec/ROADMAP.md` (slice 3 status). Verify the notes match what actually runs.
- [x] 6.3 Run the full suite from a clean checkout state (servers stopped, dev database up), confirm every spec passes and nothing is left in the database, then archive the change.
