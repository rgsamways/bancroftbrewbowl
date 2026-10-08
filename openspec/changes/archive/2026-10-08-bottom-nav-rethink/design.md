## Context

The bar is built from two pure functions in `lib/tabs.ts` (`tabsFor`, `activeTab`) drawn by `BottomTabs`. The Pick and Standings tabs go to `PickLanding` and `StandingsLanding` (`pages/TabLanding.tsx`), which pick the entry that needs attention (`attentionOrder`) and redirect. Pool pages already have a row of pool names (`PoolTabs` in `PoolStandings.tsx`, shown with two or more pools); the pick screen has none. Menu already has a section bar (`SubTabs` in `pages/Menu.tsx`). See proposal.md for the motivation.

## Goals / Non-Goals

**Goals:**
- One Play tab that opens the person's pool on the screen they last used.
- A Pick | Standings strip on every pool screen.
- A place for Games and Leagues to appear later with no further nav work.
- No change to pool, join, invite or TV addresses.

**Non-Goals:**
- A Stats tab, in-brewery games, or leagues (nothing to show yet).
- Any API, schema or scoring change.
- Moving Menu or Admin, or touching the admin bar.

## Decisions

**Keep pool URLs, add a landing at `/play`.** Pool screens stay at `/pool/:id` and `/pool/:id/entry/:id/pick`; only the bar changes. Alternative: nest them under `/play/pools/:id/...`. Rejected: it breaks saved links, the invite and join redirects, TV QR codes and a dozen specs for no behavioural gain. `/pick` and `/standings` become redirects to `/play`.

**"Play" is a landing, not a page.** `/play` resolves (remembered pool screen, else the attention-first entry's pick screen) and redirects with `replace`, exactly as `PickLanding` does now. The "no pool" message is kept. Because the bar's Play tab must stay highlighted on pool pages, `activeTab` maps `/play`, `/pool/*` and the pick path to `play`.

**Memory is two `localStorage` keys, per device.** `bbb:last-pool` (pool id) and `bbb:last-pool-screen` (`pick` or `standings`), written when a pool screen mounts and read only by the Play landing. Alternatives: store it on the server (needs an API and schema change for a convenience) or in the URL only (lost between visits). It is validated against the person's current entries, so a stale id falls back cleanly. Signing out does not need to clear it because the id is checked against the signed-in person's own entries.

**Sections are data, hidden when empty.** A small pure function `playSections({ pools, games, leagues })` returns the visible sections in order; the bar is drawn only when it returns two or more. Today `games` and `leagues` are always false, so the section bar never renders and Play is the pool. Adding Games later means flipping one input, not redoing the nav. Alternative: draw all three and grey out empty ones. Rejected: Robin's rule of no empty tabs.

**Pool tab strip is one shared component.** A `PoolScreenTabs` component takes the pool id and the current screen and renders Pick | Standings (the Pick link needs the entry id, taken from `/me/summary`, which both screens already load or can load). A third tab is a new array item. The existing pool-name row stays beneath it. A person who is a member of a pool without an entry (an admin viewing) sees only the screens that make sense: Pick is omitted when they have no entry in that pool.

**Default screen is Pick.** The first time on a device, Play opens the pick screen (as the Pick tab did), including the "Your season" view for an out entry. Alternative: Standings when nothing needs picking. Rejected as more rules for little gain; the remembered screen handles the habit.

**Tab icon:** a gamepad (Lucide `Gamepad2`) for Play.

## Risks / Trade-offs

- **One more tap for a Standings regular** (Play → Standings strip) → mitigated by remembering the last screen, so repeat visitors land where they left off.
- **Remembering can surprise** (open Play, land on Standings when a pick is due) → Home's hero is the explicit shortcut to the pick screen, and the pick-due state is on Home; revisit if it bites.
- **Many specs reference the old tabs** → one pass over about a dozen specs, plus a new spec for Play and the strip; `alignment.spec.ts` and `frame.spec.ts` are the likely surprises.
- **Name "Play"** is Robin's call and may be revisited; it is one label in `tabs.ts`.

## Open Questions

- What goes in Stats (team usage, pick percentages, history) can wait until there is data to show.
