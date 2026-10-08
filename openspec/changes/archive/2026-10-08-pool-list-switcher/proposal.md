## Why

Switching pools today uses a row of chips on Home and on Standings. Pool names are long ("The Bancroft Brewery Survivor Pool"), so with more than two pools the row overflows and looks bad, and the Pick screen has no switcher at all. Robin wants a pattern that holds up with any number of pools and works from every pool screen.

## What Changes

- **Play shows a pool list** when the person is in two or more pools: one card per pool with its name, type (Survivor or Pick 'em), the person's standing (alive or out, or rank and points) and what needs doing ("Pick due Thu 8:15 PM", "Picks made", "Locked", "Out"). Tapping a card opens that pool on the screen last used (Pick or Standings). With one pool, Play still goes straight in as today.
- **Every pool screen gets a pool-name header** (Pick and Standings), above the Pick | Standings strip. With two or more pools it is a tappable control that opens the list; with one pool it is plain text.
- **The pool-name chips are removed** from Standings.
- **Home's chips become a compact control**: the shown pool's name with a small arrow, which opens a short list of the person's pools (name and what needs doing). Choosing one shows that pool's hero in place, as the chips did. With one pool nothing is shown.
- Pool addresses do not change.
- **BREAKING (browser tests only):** specs that click pool chips on Home or Standings need updating.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-shell`: the Play tab opens a pool list when the person is in two or more pools; pool screens carry a pool-name header that opens it.
- `home`: "Home has a pool switcher when there are several pools" changes from chips to a compact control with a list.
- `standings`: "Pool tabs and the Standings tab" no longer includes a row of pool tabs.

## Impact

- Dashboard only: `pages/PlayLanding.tsx` (gains the list), `components/PoolScreenTabs.tsx` (header), `pages/PoolStandings.tsx` (remove `PoolTabs`), `pages/Home.tsx` and `components/PoolChips.tsx` (replaced by a compact switcher), a small shared helper that turns an entry into its "what needs doing" line.
- No API, database or schema change. No new dependency.
- Browser specs that use the pool chips: `frame`, `home-states`, and any others found by search.
- Docs: `openspec/ROADMAP.md`, `docs/HANDOFF.md`.
