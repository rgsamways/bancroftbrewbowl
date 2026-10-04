## 1. Live this weekend (API and shared)

- [ ] 1.1 `loadBreweryHome` returns `live` (the first event this weekend, or null) using the Music weekend rule; shared type updated; API test for this weekend, past, far-future and none

## 2. Pages

- [ ] 2.1 How to play at `/help` with the corrected copy; a How to play row on Me
- [ ] 2.2 Admin guide at `/admin/guide` with the updated copy; More links to it
- [ ] 2.3 Table card at `/admin/table-card`: real QR (`qrcode`, SVG, lazy-loaded) to `/menu`, the card copy, Print button, print styles; More links to it

## 3. Home

- [ ] 3.1 Install card with the pure show/hide rule (unit tested), "Not now" remembered on the phone
- [ ] 3.2 Live this weekend card first in "At the brewery", linking to the Music tab

## 4. Tests in a real browser

- [ ] 4.1 `e2e/help.spec.ts`: How to play from Me, Admin guide from More (and a player sent away), no sideways scroll at 390 wide
- [ ] 4.2 `e2e/install-and-live.spec.ts`: install card shown, dismissed and gone on reload, hidden when standalone; Live this weekend card appears and disappears
- [ ] 4.3 `e2e/table-card.spec.ts`: QR present and encoding the menu address, Print button, print media hides the frame; update specs that list More links

## 5. Verify and ship

- [ ] 5.1 `pnpm lint`, `typecheck`, `typecheck:e2e`, `test`, `test:e2e` pass
- [ ] 5.2 Push to `staging`, check it, then promote to `main`; confirm the production deploy (read-only checks, no test data)
- [ ] 5.3 Archive (syncs specs), update ROADMAP and HANDOFF
