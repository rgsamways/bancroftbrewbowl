## Context

See proposal.md. Standings (`routes/standings.ts`) returns names and ranks only; nothing aggregates picks. Weeks and the lock come from `lib/entry-state.ts` (`loadSeasonWeeks`, `SeasonWeek.lockTime`, `gamesPending`) and `lib/pick-lock.ts`. Pick visibility is decided in `lib/pick-visibility.ts`. There is no odds or spread data, so "upset" cannot be literal.

## Goals / Non-Goals

**Goals:** one request per page; pick counts only after the lock; both pool types; no schema change.

**Non-Goals:** a public (signed-out) TV page; per-game pick splits for pick 'em; week-over-week rank change; a recap for past weeks beyond `?week=N`; any change to scoring.

## Decisions

- **Upset = winner with the lowest pick share.** Alternatives: score margin (scores are optional and a blowout is not an upset); dropping the tile. Robin chose the share rule. Uses only data we have.
- **Share denominator = players who picked that week.** The mockup's 38% reads as a share of the field. Players who did not pick do not dilute it. Pick 'em counts a team once per entry that picked it.
- **One shared counter, `lib/pick-counts.ts`,** gated on the lock inside the function so no route can leak counts early. TV, recap and the upset all call it.
- **Computed on request, not stored.** Pools are small (tens to low hundreds of entries); a grouped count is cheap. Keeps the change schema-free and the data always consistent with scoring.
- **"Out this week" = entries with `eliminatedWeek = N`.** A waiting wipeout holds eliminations back, so the count can lag until an admin resolves it. Accepted and written into the spec.
- **TV page is signed-in only,** outside `Shell`, in a new `TvLayout` (fixed 1280 by 720 layout scaled to the screen). It polls every 30 s. A signed-out public TV page would need a share token; not worth it now.
- **`recapWeek` rides on `/me/summary`** so Home needs no extra request on bar Wi-Fi.
- **Share:** `navigator.share` when present, else copy to clipboard. Text only.
- **QR** reuses the lazy `qrcode` pattern from `pages/TableCard.tsx`, encoding the site root.

## Risks / Trade-offs

- A "biggest upset" by pick share can name an unremarkable game when the field is tiny; accepted, shown only when someone picked.
- Polling a pool's names every 30 s from a TV is light, but each poll is a few queries; fine at this size.
- Pick 'em has no mockups; it reuses the survivor styling with a leaderboard.
