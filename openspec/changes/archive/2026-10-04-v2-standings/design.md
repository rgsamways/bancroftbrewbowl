## Context

`PoolStandings.tsx` makes three requests (`/pools/:id`, `/pools/:id/entries`, `/me/entries`) and counts on the phone; pick 'em shows `#index` with no ties. The Standings tab is the interim chooser in `TabLanding.tsx`. Slice 6 added `rankWithTies`/`rankOf` (`packages/shared/src/rank.ts`), the week helpers in `apps/api/src/lib/entry-state.ts` (`loadSeasonWeeks`), the attention order (`apps/dashboard/src/lib/attention.ts`) and `computePickEmPoints`. Slice 5 added the `PoolTotalCard`. See proposal.md for the why.

## Goals / Non-Goals

**Goals:**
- One request; the server does the counting, ordering and ranking.
- Match the two standings mockups at 390 wide; reuse what slices 5 and 6 built.

**Non-Goals:**
- Per-week history, charts, streaks, rank arrows (decided out in v2), TV standings, admin tables.

## Decisions

- **New endpoint `GET /pools/:poolId/standings`.** It returns already-sorted lists so the screen only renders. Alternative: keep the three existing requests and compute on the phone. Rejected: that is where ranks and counts drifted before, and a 64-player pool means more work and more requests on bar Wi-Fi.
- **Response shape.** `{ pool: {id, name, type, seasonYear, status, poolTotalCents}, lastDecidedWeek, seasonOver, playersTotal, me: {entryId, status, rank?, tied?, points?} | null, alive: Row[], eliminated: Row[] }` for survivor and `{ ..., leaderboard: Row[], leaderPoints }` for pick 'em, with `Row = {entryId, name, isYou, status?, eliminatedWeek?, points?, rank?, tied?}`. The whole list is sent (a few dozen to a couple of hundred names) so "Show all" and "Find a player" need no further requests and search covers everyone.
- **Ordering lives on the server.** Survivor alive: you first then name A to Z (case-insensitive); eliminated: highest `eliminatedWeek` first then name; pick 'em: points descending then name. Ranks use the shared `rankWithTies` so Home and Standings cannot disagree about "T4".
- **"After week W".** The highest week number such that it and every earlier week of the season have no pending games (using `loadSeasonWeeks`); none yields "Before week 1". `seasonOver` is true when the pool is completed or there are games and none are pending.
- **Privacy is unchanged.** Names, status, elimination week and points were already readable by any signed-in player through `/pools/:id/entries`; the new route returns no email and no picks, and a test pins that. It requires a session (the old `/pools/:id` read did not) and does not check pool membership, so an admin can look at any pool.
- **Pool tabs and the Standings tab use data Home already has.** Tabs come from `GET /me/summary` (the player's entries, in attention order). The tab's landing page picks the first and redirects to `/pool/:id`, like the Pick tab. Alternative: remember the last-viewed pool. Rejected: one rule across Home, Pick and Standings is easier to explain.
- **Search is client-side over the full list.** A plain case-insensitive "contains" on the name; no debounce needed at this size.
- **Initials** move from `AppHeader` to `@bbb/shared` so list avatars and the header avatar use one rule.
- **Delete the interim chooser.** `TabLanding.tsx` and `standingsDestination` go; `lib/tabs.ts` keeps only the tab list and active-tab logic.

## Risks / Trade-offs

- [Sending the whole list for a very large pool] → pools here are tens to low hundreds of players; a single JSON of names stays small. Revisit if a pool passes a few hundred.
- [Tie ordering looks arbitrary] → ties sort by name, stated in the spec and tested.
- [Admin looks at a pool they are not in] → `me` is null and the card shows the pool name and counts, as specified.
- [e2e specs asserting the old lists] → `standings`, `frame` and `pick-privacy` are updated in the same change.

## Migration Plan

No data change. Push to `staging`, check the new endpoint there, walk the screens locally in real Chrome (the staging preview cannot reach the staging API), promote to `main`. Rollback is a revert.
