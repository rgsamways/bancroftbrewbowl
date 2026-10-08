## Why

Standings is two lists and a summary. Robin's review notes ask for more interesting ways to look at a pool, and mention the classic survivor view: a grid of which team each player took each week. With picks now revealed game by game, a week-by-week view can also feel alive during a game day: you see who is riding on the game in progress.

## What Changes

- A second view on Standings, **Week by week**, chosen with a two-way switch at the top (Standings | Week by week).
- **Survivor:** a grid with a row per player and a column for every week from 1 to the current week. Each cell is the team's colour circle with a green ring (won), red ring (lost) or grey ring (still to play). Rows run from the players still alive (A to Z) to those who went out earliest, so the grid narrows toward the bottom like an inverted triangle; the viewer's row keeps its place and is highlighted. The names column stays in place while the weeks scroll sideways. A footer row shows the most picked team of each week and its share.
- **Pick 'em:** the same grid shows points for each week (correct picks of the games decided so far), a total, and a rank, instead of teams.
- **The same privacy rules as everywhere:** a cell only shows what the viewer may already see. Picks for games that have not started (or, in a pool that waits, for a week not yet final) are blank for everyone else, exactly as on the Pick screen and the TV page. The viewer always sees their own picks.
- Weeks before the current week in which nobody in the pool picked (the free-pass weeks of a late start) still get a column. Every row shows "Free pass" there, and a note under the grid says so, so the grid looks the same all season.
- For the viewer in a survivor pool, a line says how many teams they have used and how many are left.
- Names follow the safe-name rule (no emails).
- No schema change.

## Capabilities

### New Capabilities
- `pick-grid`: the week-by-week data and the grid.

### Modified Capabilities
- `standings`: the two-way switch and the new view.

## Impact

- API: `GET /pools/:poolId/pick-grid` (signed in), built on the existing reveal test (`revealPredicate`), `publicName`, and the pick counts.
- Shared: grid types.
- Dashboard: the switch on `PoolStandings.tsx` and a new grid component (sticky names column, sideways scroll).
- Tests: API (privacy at each reveal rule, both pool types, late-start weeks left out, no emails), browser at 390 wide, update the Standings specs.
- Not included: the TV page grid, per-player drill-down pages, charts.
