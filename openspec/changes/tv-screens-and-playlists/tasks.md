## 1. The data and shared pieces

- [x] 1.1 Schema: `tv_playlists`, `tv_playlist_slides` (pool FK cascade, playlist FK cascade, unique position per playlist), `tv_screens` (unique code, playlist FK set null); `pnpm db:generate`, review the SQL is additive only, migrate the local database and verify the tables exist
- [x] 1.2 `packages/shared`: slide and screen types, Zod schemas (limits: 20 playlists, 12 slides, 10 screens, names 1 to 60, seconds 5 to 120), the feed type, and the new Activity kinds; unit tests for the schemas and that no Activity summary can carry a code
- [x] 1.3 Extract `buildPoolTv(pool, now)` from `routes/tv.ts` into `lib/` and share the menu and music loaders; verify the existing `tv-recap`/TV tests pass unchanged

## 2. The API

- [x] 2.1 Playlist routes (`GET /tv/playlists`, `POST`, `PUT /tv/playlists/:id`, `DELETE`) for admins: replace-all slide save in one transaction, duplicate-name and pool-exists checks, refuse delete while a screen plays it; tests include player refused, god-user allowed, invalid duration, deleting a pool removes its slides
- [x] 2.2 Screen routes: `GET /tv/screens` (never the code for an admin), `PATCH` (admin: playlist and QR; operator only: name), `POST` create, `DELETE`, `POST /:id/reset-link`, `GET /:id/link` (operator only); tests: an ordinary admin gets 403 and no code anywhere, reset kills the old code and keeps settings
- [x] 2.3 `GET /public/tv/:code`: enabled slides in order with content, `no-store`, plain 404 for unknown or reset codes (no rate limit: the project has none on public routes and the 256-bit code cannot be guessed); tests: no emails or picks in the whole body, "most picked" follows the reveal rule, a deleted pool or empty playlist, a disabled slide is left out
- [x] 2.4 Every write records Activity with no code in the sentence; the activity coverage test passes with no exceptions added

## 3. The TV player

- [x] 3.1 `/tv/:code` renders before the sign-in gate; fixed 1280 by 720 canvas with the 56 px QR strip; rotation by each slide's seconds, keeps its place through a refresh, keeps the last good data on failure, "Nothing to show yet" and "This TV link is no longer active" states
- [x] 3.2 Standings slide extracted from `PoolTv.tsx` (no QR block inside a screen; the signed-in page unchanged); Drinks, Kitchen (paged to fit, sold out left out) and Music slides (empty slides skipped); the QR points to `/menu` on menu slides and the home page elsewhere
- [x] 3.3 Unit tests for the paging and the rotation timer logic (including a refresh mid-slide and skipped slides)

## 4. The admin screens

- [x] 4.1 More > "TV screens" for admins: playlist list, playlist editor (name, slides with move up and down, remove, on/off, seconds, add a slide with a pool picker), screens list with a playlist selector and the QR switch; plain wording, 390 wide
- [x] 4.2 Site setup (god-user only): create, rename and delete a screen, show and copy its link, reset it with a confirm; hidden from other admins and refused by the server

## 5. Tests in a real browser

- [x] 5.1 `e2e/tv-screens.spec.ts`: build a playlist, assign it to a screen, open the private link signed out and see the slides rotate (fake clock), switch the playlist and see it change, QR strip on and off, reset the link and the old one stops, an ordinary admin cannot see links; update `e2e/alignment.spec.ts` and the More tests for the new link; the existing TV spec still passes

## 6. Verify and ship

- [x] 6.1 `pnpm lint`, `typecheck`, `typecheck:e2e`, `test`, `test:e2e` pass
- [ ] 6.2 Call out the schema change, migrate staging first, check the feed by calling the staging API, then push `main` (batch with other work; mind the Vercel build limit); Robin looks at it on a real TV
- [ ] 6.3 Sync specs, archive, update ROADMAP and HANDOFF
