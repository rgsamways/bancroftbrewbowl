## Context

See proposal.md. `GET /pools/:id/standings` returns names, status and points only, with no picks, and the Pick/TV/recap screens already hide unrevealed picks through `revealPredicate` (`lib/pick-lock.ts`) and `visiblePicks` (`lib/pick-visibility.ts`). The grid is a new place to show other players' picks, so it must go through exactly the same test, not a copy of it.

## Goals / Non-Goals

**Goals:** a week-by-week view that is correct and private by construction, readable on a phone, for both pool types.

**Non-Goals:** drill-down pages per player; charts; changing the Standings lists; showing anything the Pick screen would not.

## Decisions

- **One new endpoint, `GET /pools/:poolId/pick-grid`.** It loads the pool's picks and entries once, runs every pick through the existing `visiblePicks` with `revealPredicate(pool)`, and only then builds the grid. No second privacy rule exists anywhere, so changing the reveal or lock rule changes the grid with it.
- **What a hidden pick looks like.** An ordinary player gets nothing for another player's unrevealed pick (as `visiblePicks` already does), so the cell is blank. An admin gets the usual "picked" marker (no team), shown as a small neutral dot. The viewer's own picks are always full.
- **Columns are every week from 1 to the current week** (every season week once the season is over). A past week in which nobody in the pool has a pick is a free-pass week: its cells are kind `free_pass` for every row and the response lists those weeks so the screen can write the note ("No picks were made in weeks 1 to 4 (the pool started late), so everyone got a free pass."; "the pool started late" only when the run starts at week 1). The current week with no picks yet is not a free pass; its cells are blank until picks show. A week with games still to play stays as a column, and cells fill in as games start.
- **Survivor cells** carry the team and the pick's result (`pending`, `win`, `loss`, `tie`) so the ring colour needs no extra lookup. A double-pick week shows two small circles in the cell.
- **Pick 'em cells** carry the count of correct picks among the revealed picks of that week (and how many of the week's games it covers), plus a per-player total and a shared rank (`rankWithTies`). Because the count only uses picks that pass the reveal test, a pool that waits until the week is final shows a player's week only when it is final.
- **Most picked footer** is computed from the same revealed picks (top team and its share of revealed picks that week), so it can never show more than the grid does.
- **Rows:** alive players A to Z first, then eliminated players with the longest-lasting first (latest elimination week first, ties by name), so the grid narrows toward the bottom. Nobody is pinned: the viewer's row is highlighted with a "You" tag but stays in its place. Pick 'em: by total, ties by name. Names come from `publicName`.
- **Teams left (survivor, viewer only)** is computed from the viewer's own picks: used and remaining of 32 (or "repeats allowed" when the pool allows repeats).
- **Phone layout:** a table in a horizontally scrolling container with a sticky first column and 56 pixel week columns; a legend explains the rings. The switch is a two-button group with `aria-pressed`, remembered in the URL (`?view=weeks`) so a link opens it directly.
- **Size:** 64 players by 18 weeks is under 1,200 cells; one request, no paging.

## Risks / Trade-offs

- A wide grid on a narrow phone needs sideways scrolling; the sticky names column keeps rows readable.
- Showing other players' picks as games start is the point, and is already what the rules allow; a pool that wants more privacy uses "after the week's last game is final".
- For an admin the neutral "picked" dot shows a pick exists; ordinary players see a blank. Both match today's rules.
