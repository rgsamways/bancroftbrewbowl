## Context

Mockups: `help`, `admin-guide`, `install-prompt`, `table-card`, and the "Live this weekend" card on `home`. The menu, music and brewery sections exist (`Menu.tsx`, `lib/brewery.ts`, `loadPublicMusic`). Home already has an "At the brewery" section (`AtTheBrewery` in `Home.tsx`).

## Decisions

- **Static pages.** `Help.tsx` and `AdminGuide.tsx` are plain content with collapsible questions (native `details` elements, so they work without script and read well in print). Help is inside the Shell; the guide is inside the admin layout. Copy follows the mockups with these corrections: sign in with an emailed link, or with a password if you set one; open Me from the avatar (there is no Me tab); the guide mentions From the brewery instead of Announcements, "Next step" instead of "This week", and that a decision about your own entry needs another admin to confirm. Links: a "How to play" row on the Me page and an "Admin guide" and "Table card" row on More.
- **Install card** (`InstallCard.tsx`). Shown on the main Home view below the hero unless the app is already installed or the person said "Not now". The rule is a pure function `shouldShowInstallCard({ standalone, dismissed })`, unit tested, where `standalone` is `matchMedia("(display-mode: standalone)")` or iOS `navigator.standalone`, and `dismissed` is a `localStorage` flag (`bbb:install-dismissed`). One set of steps (Share, Add to Home Screen, Add) as in the mockup; no browser sniffing. No server involvement.
- **Live this weekend.** `loadBreweryHome` returns `live: MusicEvent | null`, the first event whose date falls in this weekend (`bucketOf(date, today) === "thisWeekend"`, using the same rule as the Music tab, in date and start-time order). Home shows it first in "At the brewery" as "Live this weekend" with the day, name and time, linked to `/menu/music`. When there is none it is left out. No column and no switch: removing the event removes the card.
- **Table card** (`TableCard.tsx`). Draws a QR with the `qrcode` package's SVG output, encoding `${window.location.origin}/menu`, inside a card with "Play Brew Bowl on your phone", "Scan to sign in, make your picks, and follow the standings from your seat.", the web address and "Please drink responsibly." The page has a Print button (`window.print()`); print styles hide the header, tab bars and button so only the card prints. The SVG carries a `data-url` attribute so a test can check what it encodes.
- **Not public.** Help is signed-in only for now; the table card is admin only (it is a thing to print, not to read).

## Risks

- A new dependency (`qrcode`): small, pure JavaScript, used only in the table card page; it is lazy-loaded with that page so Home does not pay for it.
- Print layout varies by browser; the card is sized for a half-page tent and checked in the browser's print preview by emulating print media in the test.
- The "Live this weekend" card depends on the Eastern weekend rule already covered by unit tests.
