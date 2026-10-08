## Why

The player tab bar is Home | Pick | Standings | Menu, which spends two of four slots on the two screens of one pool. The brewery plans more things to play (in-brewery games, fantasy leagues, more pool types), and none of them has a home. Robin wants one "Play" tab that holds everything you play, with a pool's own screens inside it.

## What Changes

- The player tab bar becomes **Home | Play | Menu** (plus **Admin** for admins, last). The Pick and Standings tabs are removed from the bar.
- **Play** opens the person's pool. It remembers the last pool and the last pool screen (Pick or Standings) on that device, and falls back to the pool that needs attention first, on Pick.
- A pool's screens get a small tab strip at the top: **Pick | Standings**. Stats is not added yet (nothing to put in it); the strip is built so a third tab is a one-line addition.
- Play has room for sections **Games**, **Pools** and **Leagues**, but a section only appears once it has something in it. Today only Pools has content, so no section bar is shown and Play simply opens the pool.
- Home's hero and the invite and join flows keep leading straight to the pick screen, so the weekly habit stays one tap.
- Old addresses `/pick` and `/standings` redirect to Play; pool addresses (`/pool/:id`, `/pool/:id/entry/:id/pick`) do not change, so existing links, QR codes and the join flow keep working. Those pages now highlight Play.
- Help copy that says "Open the Pick tab" is reworded.
- **BREAKING (for browser tests only):** the specs that tap the Pick or Standings tab in the bar need updating.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `app-shell`: the tabs a person sees, which tab is marked for each screen, and where Play leads (replaces the Pick tab and Standings tab requirements); adds the pool tab strip and the rule that empty Play sections are hidden.
- `standings`: the "Pool tabs and the Standings tab" requirement no longer describes a bottom-bar tab; the pool switcher stays.
- `pick-screen`: "The Pick tab goes where the player needs to be" moves to Play and the pool's Pick tab.

## Impact

- Dashboard only: `lib/tabs.ts`, `components/BottomTabs.tsx`, `App.tsx` routes, `pages/TabLanding.tsx` (becomes the Play landing), `pages/PoolStandings.tsx` and `pages/PickScreen.tsx` (add the pool tab strip), `pages/Help.tsx`, plus a small last-visited helper in `localStorage`.
- No API, database or schema change. No new dependency.
- Browser specs that use the Pick or Standings tab (about a dozen under `e2e/`) and the unit tests for `tabs.ts`.
- Docs: `openspec/ROADMAP.md`, `docs/IDEAS.md` (mark the idea as planned), `docs/HANDOFF.md`.
