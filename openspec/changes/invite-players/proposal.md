## Why

The pool started late and Robin wants players to bring their friends. Today there is no way for a player to invite anyone, and a shared join link or the TV's QR code loses its destination at sign-in: a magic-link sign-in always returns to the site's home page, so a first-timer who opens `/join/<pool>` ends up on Home instead of joining. Nothing tests the whole first-time journey either.

## What Changes

- **Remember where the person was going.** Signing in with the email link returns to the page they opened (a pool's join page, for a shared link or a QR code) instead of always Home. Only a page inside the app is ever used as the destination, never an outside address.
- **"Invite a friend".** Any signed-in player gets a button, for each pool they are in, that shares a link to that pool's join page: the phone's share sheet when it has one, otherwise the link is copied and the button says "Link copied". Available while the pool is open to new players. The link is the same for everyone and carries nothing private.
- **A first-timer joins properly.** If an account has no display name yet, the join page asks for one before joining, so a new player never shows to others as an email address. Everything else on the join page is unchanged.
- **TV QR for a pool's standings.** On a TV, a Standings slide's "Play on your phone" strip points at that pool's join page ("Scan to join <pool>") when it is open to new players; other slides keep their addresses.
- **One end-to-end test** of the whole journey from a fresh phone: shared link, sign-in, display name, join, first pick, plus the late-joiner case (earlier weeks were a free pass) and the TV code.
- No schema change, no emails sent, no invite records.

## Capabilities

### New Capabilities
- `player-invites`: the share link, the remembered sign-in destination, and the first-time journey.

### Modified Capabilities
- `join-pool`: the join page asks a new account for a display name first.
- `tv-screens`: a Standings slide's QR strip points at its pool's join page when joinable.

## Impact

- **Shared:** a safe-destination helper (accepts only an in-app path), a join-path helper, a field on the TV feed's standings slide.
- **API:** `lib/pool-tv.ts` / the TV feed adds a join path (null when the pool is not joinable). No new routes.
- **Dashboard:** `Login.tsx` (callback), an invite button component used on Home and Standings, `JoinPage.tsx` (name step), `TvPlayer.tsx` (QR address and text).
- **Tests:** unit tests for the destination helper; API test for the TV feed field; a new browser spec for the whole journey; existing specs adjusted.
- Not included: emailing invites, tracking who invited whom, rewards, a public preview of a pool for signed-out visitors, changing the signed-out front page (noted separately), admin invite flows (admins can already add a player by email).
