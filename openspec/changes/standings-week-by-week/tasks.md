## 1. The data

- [x] 1.1 Grid types in `packages/shared`; a pure builder (rows, weeks with picks, cells, footer, teams left, pick 'em points and shared ranks) with unit tests, including a double-pick week, a late start and ties
- [x] 1.2 `GET /pools/:poolId/pick-grid`: loads picks once and runs them through `visiblePicks` with `revealPredicate`; tests: signed out, own picks always, per-game reveal, whole-week reveal, waiting pool, admin marker, no emails, survivor and pick 'em, weeks without picks left out, a pool with no picks

## 2. The screen

- [x] 2.1 Two-way switch on Standings with `?view=weeks`
- [x] 2.2 The grid: sticky names column, 56 pixel week columns, colour circles with result rings, double-pick cells, pick 'em points cells, footer row, teams-left line, legend, empty state

## 3. Tests in a real browser

- [x] 3.1 `e2e/standings-grid.spec.ts`: survivor and pick 'em grids, another player's unstarted pick is blank and a started one shows, own picks always show, the switch and the address, no sideways page scroll at 390 wide, wide-window alignment; update the Standings specs

## 3b. Follow-up: free-pass weeks and row order (Robin, 2026-10-07)

- [x] 3b.1 Builder and endpoint: columns for every week 1 to the current week; `free_pass` cells and a list of free-pass weeks; survivor order alive A to Z then longest-lasting first with no pinned row; pick 'em unpinned; unit test on made-up data with many exit weeks proving the triangle, and tests for a late start (weeks 1 to 4 free pass, week 5 current) and a current week with no picks
- [x] 3b.2 Screen: "Free pass" cells, the note under the grid, the viewer's row highlighted but not moved; update `e2e/standings-grid.spec.ts` and `e2e/alignment.spec.ts`

## 4. Verify and ship

- [x] 4.1 `pnpm lint`, `typecheck`, `typecheck:e2e`, `test`, `test:e2e` pass
- [ ] 4.2 One push to `main` (batch with other work; mind the Vercel build limit); look at it on a phone on a game day
- [ ] 4.3 Sync specs, archive, update ROADMAP and HANDOFF
