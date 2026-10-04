## 1. The rule

- [x] 1.1 `publicName` helper in `@bbb/shared` (empty or "@" → part before the "@", else "A player"); unit tests for plain names, emails, empty, "@" first, whitespace

## 2. Server

- [x] 2.1 Standings, TV and the Home champion line use it; API tests: an email-named player shows as the local part on both pool types, and no "@" appears in either answer

## 3. Screen

- [x] 3.1 Home "What should we call you?" card (shown when the name is empty or has an "@"), saves with the Me page's call, disappears after saving, never blocks play

## 4. Tests in a real browser

- [x] 4.1 e2e: an email-named player sees the card, saves a name, the card goes, and Standings shows the new name; a named player never sees it

## 5. Verify and ship

- [x] 5.1 `pnpm lint`, `typecheck`, `typecheck:e2e`, `test`, `test:e2e` pass
- [x] 5.2 Push to `staging`, check, promote to `main` (no migration), confirm the deploy
- [x] 5.3 Sync specs, archive, update ROADMAP and HANDOFF
