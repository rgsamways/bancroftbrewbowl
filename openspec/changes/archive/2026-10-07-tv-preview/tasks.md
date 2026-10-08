## 1. The API

- [x] 1.1 Move the feed-building loop into `buildFeed(name, showQr, playlistId)` and use it from the public route; verify the existing `tv-screens` API tests pass unchanged
- [x] 1.2 `GET /tv/screens/:id/preview` and `GET /tv/playlists/:id/preview` (`requireAdmin`, `no-store`, 404 for unknown or malformed ids); tests: admin allowed, player and signed-out refused, unknown id 404, a screen's preview equals its public feed, a playlist's preview works with no screen, the response contains no private link

## 2. The screens

- [x] 2.1 `TvPlayer` takes `feedPath` and optional `onClose`; the Close button renders outside the canvas only when `onClose` is passed; the public route is unchanged
- [x] 2.2 Preview routes `/admin/tv/preview/screens/:id` and `/admin/tv/preview/playlists/:id` inside `RequireAdmin`, outside `AdminLayout`; Close goes back, falling back to `/admin/tv`
- [x] 2.3 Preview buttons on each screen and each playlist in `AdminTv`, and in `AdminTvPlaylist` (not shown for a new, unsaved playlist) with the note "Preview shows the saved playlist"

## 3. Tests in a real browser

- [x] 3.1 `e2e/tv-screens.spec.ts`: Preview from a screen and from a playlist play full-screen and rotate with the fake clock, Close returns to the admin screen, the real TV page has no Close button, a player cannot open a preview address

## 4. Verify and ship

- [x] 4.1 `pnpm lint`, `typecheck`, `typecheck:e2e`, `test`, `test:e2e` pass
- [x] 4.2 Push `main` (no schema change; batch with other work); Robin tries Preview on production
- [x] 4.3 Sync specs, archive, update ROADMAP
