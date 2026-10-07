## Why

Admins can build playlists and point screens at them, but the only way to see what a TV will show is to open the screen's private link, which only the site owner can see. Lark needs a way to check a playlist (before assigning it, or when a TV looks wrong) without asking for the link.

## What Changes

- A **Preview** button on each screen (plays that screen's playlist exactly as its TV would, with its name and QR strip setting) and on each playlist, in the list and in the editor (plays that saved playlist even if no screen plays it yet).
- Preview opens full-screen, looks and times itself like a real TV, and has a **Close** button in the corner that a real TV does not have.
- It shows the saved playlist only; the admin screens say so ("Preview shows the saved playlist").
- Read-only: nothing is written and nothing is recorded in Activity.
- No schema change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities
- `tv-screens`: admins can preview a screen's or a playlist's feed without the private link.

## Impact

- **API:** two admin-only read routes, `GET /tv/screens/:id/preview` and `GET /tv/playlists/:id/preview`, returning the same feed shape as the public TV feed. The feed builder in `routes/tv-screens.ts` is shared by both.
- **Dashboard:** `TvPlayer` takes the feed's address and an optional Close button; two full-screen preview routes inside the admin guard; Preview buttons on `AdminTv` and `AdminTvPlaylist`.
- **Tests:** API (admin allowed, player and signed-out refused, unknown id 404, same feed as the public one, no private link in the response) and a browser spec.
- Not included: previewing unsaved edits, a phone-sized frame, changing what a TV shows live.
