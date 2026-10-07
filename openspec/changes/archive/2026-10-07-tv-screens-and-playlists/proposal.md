## Why

The brewery's TV can only show one thing: one pool's standings, on a page that needs someone signed in. Lark wants more on the screens (the menu, what music is coming up, special menus for holidays) and may run more than one TV with different things on each. Robin also wants this as a selling point of the app for other venues.

## What Changes

This is stage 1 of three. Stage 2 adds "change it now"; stage 3 adds custom text and images and holiday menus. Both are out of scope here.

- **Playlists:** a named, ordered list of slides. Each slide is one of Standings (for a chosen pool), Drinks, Kitchen or Music, with its own on/off switch and how many seconds it stays up. Any admin can create, edit, reorder and delete playlists.
- **Screens:** one per physical TV (for example "Bar TV", "Patio TV"). Each has its own private link that opens it with no sign-in, and plays one playlist. Any admin can change which playlist a screen plays and turn its QR strip on or off. Only the god-user creates, renames or deletes a screen, sees its link, or resets the link.
- **TV player page:** `/tv/<private code>` rotates through the playlist's enabled slides and refreshes its data every 30 seconds. It shows a thin permanent "Play on your phone" QR strip on every slide (off per screen if wanted). Menu slides point the QR at the public menu.
- **Admin screens:** "TV screens" under More for playlists and screen assignment. Site setup (god-user only) holds creating screens and links.
- The existing signed-in `/pool/:poolId/tv` page keeps working exactly as it does today.
- Schema change: three new tables. Every admin write records Activity.

## Capabilities

### New Capabilities
- `tv-playlists`: named playlists of ordered slides, and the admin screens to manage them.
- `tv-screens`: screens with private links, the public no-sign-in feed and player page, the QR strip, and the god-user-only screen setup.

### Modified Capabilities
- `admin-activity`: new kinds of recorded change for playlists and screens.

## Impact

- **Database:** new tables `tv_playlists`, `tv_playlist_slides`, `tv_screens` (one migration). Staging first; call out before pushing.
- **API:** new `apps/api/src/routes/tv-screens.ts` (admin and god-user routes plus the public feed). The standings body now comes from a shared builder in `lib/` that both `GET /pools/:poolId/tv` and the feed use; the menu and music loaders are shared the same way.
- **Shared:** `packages/shared` gets the screen and playlist types and new Activity kinds.
- **Dashboard:** new TV player page and slide components (reusing the standings TV layout), TV screens admin pages, a route that renders before the sign-in gate (like the public menu).
- **Privacy:** the public feed carries only what is already public (menu, music) plus standings names and counts exactly as the TV page shows them today. It never carries emails or picks.
- **Tests:** API tests, shared unit tests, and a browser spec for the player and the admin screens.
