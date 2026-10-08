## Context

`Login.tsx` sends `callbackURL: window.location.origin` for the emailed link, so the destination is lost. For a password sign-in nothing is lost: signed out, `App.tsx` shows the sign-in page at whatever address was opened, and once signed in the same address renders. The join page is `/join/:poolId` (`JoinPage.tsx`) and already skips to the pick screen for someone already in; a display-name ask exists on Home (`needsDisplayName` in `packages/shared/src/display-name.ts`). The TV player (`TvPlayer.tsx`) builds the strip's QR address from the current slide. `signIn(..., callbackPath)` in the e2e helper opens a magic link with a chosen callback. See proposal.md for scope.

## Goals / Non-Goals

**Goals:** a shared link or a TV code takes a stranger all the way to a saved first pick; no new tables, routes or emails.

**Non-Goals:** emailing invites, tracking inviters, a public pool preview, a new signed-out front page.

## Decisions

- **One safe-destination helper in `packages/shared`** (`safeDestination(path)`): returns the path only if it starts with a single `/`, has no `//`, no backslash, no `:` before the first `/`... in practice a short allow-list check (`^/[A-Za-z0-9._~!$&'()*+,;=:@%/?#-]*$` with no `//` and no `\`), no control characters, and length under 500; otherwise `/`. `Login.tsx` sends `callbackURL = origin + safeDestination(pathname + search)`. The server's trusted-origin check already limits callbacks to the site's own origin, so this is defence in depth. *Alternative:* a `?next=` parameter: more moving parts and an open-redirect risk for no benefit.
- **Password sign-in needs nothing.** The page is rendered by address, so the join page simply appears after sign-in. The e2e test covers the email-link route, which is the one that broke.
- **Invite button** is a small component (`InviteButton`) taking `{ poolId, poolName, joinable }`. It builds `${origin}/join/${poolId}` and the text "Join me in <pool> at Bancroft Brewing's Brew Bowl". `navigator.share` is used when it exists (and the user cancelling the sheet is not an error); otherwise `navigator.clipboard.writeText`, then "Link copied". It lives on Home's pool chips area for each pool the player is in and on the Standings header. "Joinable" is `pool.status !== "completed"`, matching the join page. No request is made and nothing is stored, so there is no inviter tracking by design.
- **Join page name step.** When `needsDisplayName(session.user.name)` the page shows the same kind of single-field form Home uses, saved through the same call, and withholds the Join button until saved. Extract the Home form into a shared component so both use one definition. After saving, the page continues in place.
- **TV feed field.** The standings slide content gains `joinPath: string | null` (`/join/<poolId>` when the pool's status is not completed, else null), set in `buildFeed`, not in the signed-in route. `TvPlayer` uses it for the strip when the slide is Standings: QR address `origin + joinPath`, text "Scan to join <pool name>".
- **The journey test** (`e2e/invite-journey.spec.ts`) uses a fresh signed-out context. It captures the real sign-in request's `callbackURL` to prove the destination is sent, then opens the verify link with that callback as `signIn` does, so the browser really lands on the join page. Both pool types are not needed: survivor covers it, with a pick 'em smoke for the name step.

## Risks / Trade-offs

- [An open redirect through the destination] → The helper accepts only a plain in-app path, is unit tested against the known tricks, and the auth server independently limits callbacks to its own origin.
- [The Web Share API is missing on desktop browsers] → Copy to the clipboard as the fallback; if that fails too, show the link in a field to copy by hand.
- [Anyone with the link can join the pool] → That is already true of `/join/<poolId>` today; joining still follows the pool's own rules (locked pools, finished pools).
- [The name step duplicates Home's ask] → One shared component.

## Migration Plan

None: no schema or data change. Ship with the normal push.
