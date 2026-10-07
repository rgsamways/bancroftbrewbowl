## Context

Today the TV is one signed-in page, `/pool/:poolId/tv` (`PoolTv.tsx`, `GET /pools/:poolId/tv` in `routes/tv.ts`), laid out on a fixed 1280 by 720 canvas (`TvLayout.tsx`) and refreshed every 30 seconds. The public menu (`GET /public/menu`, `loadMenu`) and music (`GET /public/music`, `loadPublicMusic`) already need no sign-in. The god-user guard `requireOperator` and the Activity coverage test exist (`lib/guards.ts`, `lib/activity-coverage.test.ts`). The project avoids schedulers and stored derived state. See proposal.md for why and the three-stage plan.

## Goals / Non-Goals

**Goals:**
- Several screens, several playlists, each screen playing one playlist, all editable without a deploy.
- A TV can run unattended for weeks: no sign-in, no expiry.
- Stage 2 ("change it now") and stage 3 (new slide kinds, holiday menus) can be added without reshaping the tables.

**Non-Goals:**
- Scheduling a playlist by date or time (Robin: not in stage 1).
- Custom text or images, holiday menus, "change it now", a faster refresh.
- Replacing the signed-in `/pool/:poolId/tv` page.

## Decisions

**1. Three tables.** `tv_playlists` (id, name, timestamps), `tv_playlist_slides` (id, playlist_id cascade, kind text, pool_id nullable cascade to `pools`, position, seconds, enabled), `tv_screens` (id, name, code unique, playlist_id nullable set null, show_qr default true, timestamps). `kind` is plain text validated by Zod (`standings | drinks | kitchen | music`), so stage 3 adds kinds without a migration; stage 3 can add a nullable `payload jsonb` column then. Slide order is `position`, rewritten as 0..n-1 on every save.
*Alternative:* a single jsonb `slides` array on the playlist. Simpler, but a pool deletion could not remove its slides by foreign key, and "which playlists use this pool" becomes a scan.

**2. Playlist editing is replace-all.** `PUT /tv/playlists/:id` takes the name and the full ordered slide list and rewrites the slides in one transaction. It matches how the editor works (reorder, toggle, save) and removes any need for per-slide routes or reorder conflicts. Creating is `POST /tv/playlists` with the same body. One activity record per save.

**3. The private link is a random code stored as text.** 32 random bytes, base64url (43 characters), generated with `crypto.randomBytes`, unique index. Stored in plain text, not hashed, because the god-user must be able to see and copy the link again; the content behind it is deliberately low-risk, and the code is never written to Activity, logs we control, or any route except the god-user's. Resetting replaces the code. *Alternative:* store only a hash and show the link once: safer if the database leaks but a lost link means a reset, which is annoying on a TV mounted on a wall.

**4. One public feed per screen.** `GET /public/tv/:code` returns `{ screen: { name, showQr }, slides: [{ id, kind, seconds, ...content }] }` with enabled slides only, `Cache-Control: no-store`. The content builders are extracted into `lib/` and shared with the existing routes: `buildPoolTv(pool, now)` from `routes/tv.ts`, and the existing `loadMenu` and `loadPublicMusic`. The Standings slide therefore carries exactly the body of `GET /pools/:poolId/tv` (display names, counts, points; most picked only when the reveal rule allows), so there is one privacy rule, not two. A pool or playlist that has gone away just drops its slides. Unknown or reset codes return a plain 404 with no body detail. The route needs a light per-IP rate limit like the other public routes; the code space makes guessing infeasible anyway.
*Alternative:* the page makes one request per slide. More requests from an unattended TV and no single consistent snapshot.

**5. The player is client-side.** `/tv/:code` is rendered before the sign-in gate (like `PublicMenuPage` in `App.tsx`). It polls the feed every 30 seconds; a refresh replaces the slide data but keeps the current slide id and timer, so a refresh never restarts the rotation. A failed refresh keeps the last good data. Slides with nothing to show (Music with no coming events, a menu section list that is empty) are skipped. Menu slides are split into pages that fit 1280 by 664 and the slide's seconds are shared across its pages (at least 4 seconds a page), so a long menu is still fully shown. The QR strip is a fixed 56 pixel band at the bottom of the canvas on every slide, which leaves the slide a 1280 by 664 area; the standings slide drops its own QR block when it runs inside a screen (the signed-in page keeps it).
*Alternative:* the server decides the current slide from the time. It would keep several TVs in sync but needs the server clock for every request and breaks if the TV's browser is paused; not needed with independent screens.

**6. Who can do what.** Playlist routes use `requireAdmin` (which the god-user passes). `PATCH /tv/screens/:id` takes `{ playlistId?, showQr? }` for any admin; `name` in that body, `POST /tv/screens`, `DELETE`, `POST /tv/screens/:id/reset-link` and `GET /tv/screens/:id/link` use `requireOperator`. `GET /tv/screens` (admin) never includes the code; the god-user's response adds it. Admins see "TV screens" under More; creating screens and links live under the existing Site setup (god-user only).

**7. Activity.** New kinds in `packages/shared/src/admin-activity.ts`, category `content`: `tv_playlist_saved`, `tv_playlist_deleted`, `tv_screen_playlist_set`, `tv_screen_created`, `tv_screen_deleted`, `tv_screen_link_reset`, plus `tv_screen_renamed`. No migration. Summaries name the playlist and screen, never the code. The coverage test covers the new routes without exceptions.

**8. Limits** keep it simple and cheap: 20 playlists, 12 slides each, 10 screens, names 1 to 60 characters, seconds 5 to 120.

## Risks / Trade-offs

- [A leaked link shows standings names, menu and music on any browser] → The content is low-risk by design; the god-user can reset a link in one tap; the feed is `no-store`.
- [A long menu might not fit] → Automatic paging with a minimum time per page; tested with a made-up long menu.
- [The standings TV layout is two columns and was designed to include its own QR block] → Extract the slide body from `PoolTv.tsx` without changing the signed-in page; the existing TV browser tests stay green and a new one covers the slide.
- [Three new tables are the first schema change since the menu work] → Migrate staging first, call it out before pushing production (preDeploy migrates automatically).
- [The TV's own browser can sleep or be paused] → Out of our control; the page recovers on its next refresh.
- [No "change it now" yet] → A playlist switch can take up to 30 seconds to show; stage 2 adds a faster check.

## Migration Plan

One additive migration (three tables, no data changes, nothing destructive). Staging first and check the feed by calling its API (the staging preview site cannot call the staging API). Production's preDeploy migrates on push. Rollback is leaving the tables unused; no existing behavior changes.
