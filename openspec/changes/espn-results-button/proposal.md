## Why

Every week an admin has to enter each game's result by hand, or Robin has to run a terminal command. Robin wants the owner, his wife, or anyone with permission to do the weekly update with one tap. ESPN's public scoreboard already gives final results, and the schedule importer already reads it.

## What Changes

- A "Check for results" button on the admin Results screen. It asks ESPN which games have finished that are still undecided here, and shows them ("6 games finished: KC 27, BUF 24 ...") without changing anything.
- A Confirm step applies them. Each result is saved and scored exactly as a hand-entered result is today (eliminations, mulligans, wipeouts held for an admin), for every pool in the season.
- Only games that are still undecided are filled. A result an admin entered by hand is never overwritten; if ESPN disagrees with one, the screen says so and leaves it alone.
- One record in Activity per import, under the admin's name, flagged when it changed the admin's own entry.
- If ESPN can't be reached or answers oddly, the screen says so and the manual Results screens still work. No scheduled job: it only runs when someone taps.
- The schedule script keeps working; both now share one ESPN reader.
- No schema change.

## Capabilities

### New Capabilities
- `espn-results`: previewing and applying finished results from ESPN.

### Modified Capabilities
- `admin-steps`: the Results screen gets the Check for results button and its states.

## Impact

- API: new `lib/espn.ts` (the reader, shared with `scripts/seed-schedule.ts`), two admin routes (`GET /admin/results/espn`, `POST /admin/results/espn/apply`), a `results_imported` activity kind in `packages/shared/src/admin-activity.ts`.
- Dashboard: the Results screen.
- Tests: API tests with a fake ESPN reader, shared/unit tests for matching and ties, an e2e with a small stub ESPN server (`ESPN_BASE_URL`).
- Roles later: a rule such as `import_results` (see `docs/ROLES_AND_RULES.md`); for now admin only.
