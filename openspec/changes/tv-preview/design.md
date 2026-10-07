## Context

`GET /public/tv/:code` builds a screen's feed inline (`routes/tv-screens.ts`); `TvPlayer.tsx` fetches that feed by code, rotates it and refreshes every 30 seconds. Admins never see a screen's code, so they cannot open it. See proposal.md.

## Goals / Non-Goals

**Goals:** a preview that is the same code path as a real TV, so what an admin sees is what the TV will show.

**Non-Goals:** previewing unsaved edits, a phone-sized frame, any write.

## Decisions

- **Share the feed builder.** The slide-building loop moves out of the public route into `buildFeed(name, showQr, playlistId)`. The public route, the screen preview and the playlist preview all call it, so there is one definition of what a TV shows.
- **Two read routes** (`GET /tv/screens/:id/preview`, `GET /tv/playlists/:id/preview`) behind `requireAdmin`, `no-store`, 404 for an unknown or malformed id. The screen preview returns the screen's own name and QR setting; the playlist preview returns the playlist's name and `showQr: true`. Neither includes the code.
- **`TvPlayer` gets a `feedPath` and an optional `onClose`.** The public route passes the code-based path and no close button; the preview pages pass the admin path and a Close button (a corner button with an accessible label, outside the 1280 by 720 canvas so it never covers a slide, and not scaled with it). The rotation and refresh code is untouched, so a preview times itself exactly like a TV.
- **Preview pages** `/admin/tv/preview/screens/:id` and `/admin/tv/preview/playlists/:id` sit inside `RequireAdmin` but outside `AdminLayout` so they are full-screen. Close goes back one page in history, falling back to `/admin/tv`.
- **Saved only, said plainly.** The editor shows "Preview shows the saved playlist" beside the button and the button is disabled for a brand-new, unsaved playlist.
- **No Activity** for a read, and the coverage test only inspects write routes, so it is unaffected.

## Risks / Trade-offs

- [An admin previews and expects unsaved edits] → The note beside the button, and the button disabled until the playlist exists.
- [The preview's Close button appearing on a real TV] → It renders only when `onClose` is passed, which only the admin preview pages do; a browser test checks the real TV page has none.
- [Refactoring the public feed route could change what TVs show] → The existing feed tests pass unchanged and a new test compares preview and public output.
