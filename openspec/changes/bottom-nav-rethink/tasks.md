## 1. Tab logic

- [x] 1.1 Change `lib/tabs.ts`: tab keys become home, play, menu, admin; `/pick`, `/standings`, `/play`, `/pool/*` and the entry pick path map to play; add `playSections`. Verify with updated unit tests (every path in the app-shell spec, admin vs player tabs, sections hidden when empty).
- [x] 1.2 Add a last-visited helper for the pool id and screen (`localStorage`, validated against current entries). Verify with unit tests: stored, stale, missing and corrupted values.

## 2. Screens

- [x] 2.1 Replace `PickLanding` and `StandingsLanding` with one Play landing at `/play` (remembered screen, else attention-first pick screen, no-pool message); `/pick` and `/standings` redirect to it. Verify in the browser: first visit, returning to Standings, two pools, a pool the person left.
- [x] 2.2 Add the shared `PoolScreenTabs` strip (Pick | Standings) to the pick screen and Standings, and record the last pool and screen when either mounts. Verify in the browser: switching screens, switching pools keeps the screen, an out entry shows "Your season".
- [x] 2.3 Update `BottomTabs` (Home, Play, Menu, Admin; Gamepad icon) and confirm the Home hero, join and invite redirects still reach the pick screen directly. Verify the bar on a 390 px screen with no sideways scroll.
- [x] 2.4 Reword the Help line "Open the Pick tab" and check Help and the Admin guide for other tab references. Verify by searching for "Pick tab" and "Standings tab" in `apps/dashboard/src`.

## 3. Specs and tests

- [x] 3.1 Update every browser spec that taps the Pick or Standings tab (`frame`, `home-states`, `pick-states`, `standings*`, `join-and-pick`, `invite-journey`, `per-game-picks`, `alignment` and others found by search). Verify with `pnpm test:e2e` passing.
- [x] 3.2 Cover (as tests in `e2e/frame.spec.ts`, which already has the multi-pool players) the spec scenarios (tabs per role, highlight on pool pages, memory, old addresses, strip, no section bar). Verify it passes.
- [x] 3.3 Run `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:e2e` and `pnpm test`; all clean.

## 4. Finish

- [ ] 4.1 Update `openspec/ROADMAP.md`, `docs/IDEAS.md` and `docs/HANDOFF.md`; look at it on a phone-size window, then sync specs and archive the change. No schema change, so a normal push to `main` (batch with other work; skip `staging` if nothing else needs checking).
