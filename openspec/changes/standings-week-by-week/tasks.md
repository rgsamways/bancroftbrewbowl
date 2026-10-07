## 1. The data

- [ ] 1.1 Grid types in `packages/shared`; a pure builder (rows, weeks with picks, cells, footer, teams left, pick 'em points and shared ranks) with unit tests, including a double-pick week, a late start and ties
- [ ] 1.2 `GET /pools/:poolId/pick-grid`: loads picks once and runs them through `visiblePicks` with `revealPredicate`; tests: signed out, own picks always, per-game reveal, whole-week reveal, waiting pool, admin marker, no emails, survivor and pick 'em, weeks without picks left out, a pool with no picks

## 2. The screen

- [ ] 2.1 Two-way switch on Standings with `?view=weeks`
- [ ] 2.2 The grid: sticky names column, 56 pixel week columns, colour circles with result rings, double-pick cells, pick 'em points cells, footer row, teams-left line, legend, empty state

## 3. Tests in a real browser

- [ ] 3.1 `e2e/standings-grid.spec.ts`: survivor and pick 'em grids, another player's unstarted pick is blank and a started one shows, own picks always show, the switch and the address, no sideways page scroll at 390 wide, wide-window alignment; update the Standings specs

## 4. Verify and ship

- [ ] 4.1 `pnpm lint`, `typecheck`, `typecheck:e2e`, `test`, `test:e2e` pass
- [ ] 4.2 One push to `main` (batch with other work; mind the Vercel build limit); look at it on a phone on a game day
- [ ] 4.3 Sync specs, archive, update ROADMAP and HANDOFF
