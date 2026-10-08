## 1. Shared pieces

- [ ] 1.1 `packages/shared`: `safeDestination` (accepts `/join/abc?x=1`, `/pool/1/tv`, refuses `//evil.com`, `https://evil.com`, `javascript:`, `/\evil.com`, a backslash, control characters, empty, an over-long path, a path starting without `/`) and `joinPathFor(pool)`; unit tests for each case
- [ ] 1.2 The TV feed's standings slide carries `joinPath` (set in `buildFeed`, null for a completed pool); API test: open pool gives `/join/<id>`, completed pool gives null, nothing else new in the response

## 2. The screens

- [ ] 2.1 `Login.tsx` sends `callbackURL` as origin plus `safeDestination(path and query)`; check by test that a shared join address is sent and that an unsafe path falls back to Home
- [ ] 2.2 `InviteButton` (share sheet, else copy with "Link copied", else show the link to copy by hand) on Home for each pool the player is in and on the Standings header; hidden for a finished pool; no request made
- [ ] 2.3 The display-name ask extracted from Home into one shared component; the join page shows it first when the account has no display name, withholds Join until saved, then continues in place; Home still works as before
- [ ] 2.4 `TvPlayer`: on a Standings slide the strip's QR points at `joinPath` with "Scan to join <pool>"; other slides unchanged; the signed-in pool TV page unchanged

## 3. Tests in a real browser

- [ ] 3.1 `e2e/invite-journey.spec.ts`: fresh signed-out phone opens a shared join link, sees sign-in, requests the email link (the request's callback is the join address), opens it and lands on the join page, sets a display name, joins, picks a team and sees it saved, appears under that name and not an email; late-joiner variant (weeks decided with no picks show as a free pass, can pick this week); TV strip on a Standings slide encodes the join address
- [ ] 3.2 Browser checks for the invite button (copy fallback says "Link copied", link has no private details, absent for a finished pool and for pools the player is not in); update `e2e/alignment.spec.ts` and any Home or join specs the new elements touch

## 4. Verify and ship

- [ ] 4.1 `pnpm lint`, `typecheck`, `typecheck:e2e`, `test`, `test:e2e` pass
- [ ] 4.2 Push `main` (no schema change); Robin invites a friend from his phone and watches the journey
- [ ] 4.3 Sync specs, archive, update ROADMAP and HANDOFF
