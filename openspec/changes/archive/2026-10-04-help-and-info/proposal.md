## Why

Slice 13a of the v2 build. Players need plain answers about how the game works, admins need a guide for running a week, phones should be able to keep Brew Bowl on the home screen, the Home screen should say when a band is playing, and the brewery needs a printable table card with a real QR code. These are the pieces of slice 13 that need no new server numbers; the TV standings and weekly recap follow as 13b.

## What Changes

- **How to play** at `/help` for signed-in players, linked from Me: the two games, picking, and your account, with the sign-in wording updated for password sign-in.
- **Admin guide** at `/admin/guide`, linked from More: running a week, setting up, and what to do when something goes wrong, updated for From the brewery and for "ask another admin to confirm".
- **Install card** on Home: "Add Brew Bowl to your home screen" with three steps and "Not now". Hidden once the app runs from the home screen, and after "Not now". Remembered on the phone only.
- **Live this weekend** card at the top of Home's "At the brewery" section when a music event is on this weekend. It appears and disappears by itself; there is no "show on Home" switch (the mockup's switch is dropped). It links to the Music tab.
- **Table card** at `/admin/table-card`, linked from More: a printable card with a real QR code that opens the public menu page (which also invites people to play), the web address, and "Please drink responsibly."
- No schema change.
- **Not in this change:** TV standings and the weekly recap (13b), a public version of How to play, and the late-start plan (raised with Robin separately).

## Capabilities

### New Capabilities
- `help-and-info`: How to play, the Admin guide, the install card, and the table card.

### Modified Capabilities
- `from-the-brewery`: Home's brewery section gains the Live this weekend card.
- `admin-steps`: More links to the Admin guide and the Table card.

## Impact

- API: `GET /me/summary` `brewery` gains `live` (`lib/brewery.ts`, `packages/shared/src/brewery.ts`).
- Dashboard: new `Help`, `AdminGuide`, `TableCard` pages, `InstallCard` component, changes to `Home.tsx`, `Account.tsx`, `AdminMore.tsx`, `App.tsx`; one new dependency, `qrcode` (QR drawn in the browser; nothing sent to a third party).
- Tests: API test for `live`, unit test for the install-card rule, new and updated `e2e/` specs.
