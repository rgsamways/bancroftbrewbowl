## Why

A player who has not set a display name is shown by the name their account was created with, which is their email address. Standings, the TV page and the Home champion line show that name to every signed-in player, so an email can appear on a public screen (seen on production: Lark's address on Standings). That breaks the rule that emails are private.

## What Changes

- One shared rule for what other players are shown: a name that is empty, or that contains an "@", is replaced by the part before the "@" (and "A player" if nothing is left). Used by Standings, the TV page and the Home champion line, in one helper so no screen can forget it.
- Home shows a small "What should we call you?" card whenever the account's name is empty or looks like an email. Saving it sets the display name, and the card goes away. Same field as the Me page.
- Admin screens are unchanged (admins may see emails under the roles rules).
- No schema change.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `standings`: player names never show an email address.
- `tv-standings`: same rule on the TV page.
- `home`: the name card.

## Impact

- Shared: a `publicName` helper with unit tests.
- API: `routes/standings.ts`, `routes/tv.ts`, `routes/home.ts` use it (the recap shows only the viewer's own result and needs nothing).
- Dashboard: a card in `pages/Home.tsx` using the same sign-in client call as the Me page.
- Tests: shared unit test, API tests for Standings and TV, an e2e step for the card.
