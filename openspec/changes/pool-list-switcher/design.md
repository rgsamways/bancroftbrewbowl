## Context

`/play` is a landing that redirects (`pages/PlayLanding.tsx`). `PoolScreenTabs` is a layout route around the pick screen and Standings, with the Pick | Standings strip and the last-pool memory (`lib/lastPool.ts`). Standings has its own `PoolTabs` chips; Home uses `PoolChips`, which switch the hero by entry id. Each entry in `/me/summary` already carries state, lock time, status, rank and points, and `lib/attention.ts` already orders entries by need. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- One way to switch pools that works for any number of pools and any name length.
- Switching from every pool screen and from Home.
- No API change.

**Non-Goals:**
- Pool search, pinning or reordering.
- Changing what Home's hero shows.
- Games and Leagues sections (still hidden until they have content).

## Decisions

**The list is `/play` itself.** With two or more pools `/play` renders the list instead of redirecting; with one pool it still redirects as now. The pool-name header links to `/play`, so there is no new route or address. Alternative: a separate `/play/pools` page. Rejected: the same screen, one more address to keep working.

**Cards open the pool on the last-used screen.** The memory (`bbb:last-pool-screen`) is already a screen name, so a card links to Pick or Standings by that name for whichever pool is chosen. `lastPoolPath` is generalised to take a pool id. The remembered pool id is no longer used to skip the list when there are several pools, because the list is where that choice is made; it is still used with one pool. Alternative: per-pool memory. Rejected as more state for little gain.

**"What needs doing" is one shared pure function.** `entryNeed(entry)` in `lib/` returns a short line from the entry's state and lock time ("Pick due Thu 8:15 PM", "Picks made", "Locked", "Out", "Season over", "No games yet"). The list cards and Home's switcher both use it, so wording cannot drift. Times use the existing Eastern-time helper (`@bbb/shared` game-time). Order uses `attentionOrder`.

**Header is part of the pool layout.** `PoolScreenTabs` renders the pool name (from the summary, falling back to nothing while it loads) above the strip, as a link to `/play` when the person has two or more entries. `PoolTabs` is deleted from Standings. Pick screens inherit the header with no change to the screen.

**Home gets a disclosure, not the list page.** Home switches the hero in place by entry id, and leaving Home to pick a hero would be a step back. A button (pool name and a chevron) toggles an inline list of the entries (name and `entryNeed` line), marked `aria-current` for the shown one. `PoolChips` is deleted. Alternative: a native `select`. Rejected: no room for the second line and awkward on phones.

## Risks / Trade-offs

- **One more tap for people in several pools** (Play opens a list, not the pool) → the header on every pool screen and Home's control keep switching to one tap, and the list shows what needs a pick first.
- **Header takes vertical space on pool screens** → one line of text above the strip; check the pick screen's bottom bar still clears on a 390 px screen.
- **Many specs touch the chips** (`frame`, `home-states`) → updated in the same change.

## Open Questions

- Whether the list should also show the week's result line later (for example "Won last week"); can wait until there is demand.
