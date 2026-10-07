## Why

Lark wants one place to show what is coming up at the brewery: bands, food and drink specials, events, closures. Music events are the only dated things the app knows today. A calendar also gives players a reason to open the site and a way to send them somewhere specific (the menu, a pool, sign-up). It follows `tv-screens-and-playlists`, whose TVs need a full-month slide.

## What Changes

- **Calendar entries:** a new list of dated entries (title, date, optional start and end time, type, optional note, optional link). Any admin manages them under More. Types: Music, Food special, Drink special, Event, Closed, Other.
- **Repeats, kept simple:** an entry is "just this day", "every week", "every 2 weeks" or "monthly on the same weekday" (like the 2nd Friday), with an optional end date. Any single day of a series can be changed or cancelled on its own; editing asks "just this day" or "all in the series". Days are worked out when asked for; nothing is stored per day and nothing runs on a timer.
- **Music appears by itself:** music events already entered show on the calendar, read-only there, so nobody types a band twice.
- **Mobile calendar:** a public page at `/menu/calendar`, a fourth tab beside Drinks, Kitchen and Music, no sign-in. It shows the current month with previous and next arrows; days with entries can be tapped to open that day's list; an entry with a link shows a button.
- **TV slide:** a new "Calendar" slide kind for playlists, showing the current month as a full-screen grid with small coloured type tags and "+N more" when a day overflows. Links are not tappable on a TV.
- Schema change: new tables. Every admin write records Activity.

Out of scope: custom repeat patterns, holiday menus, "change it now", players adding entries, reminders or notifications.

## Capabilities

### New Capabilities
- `calendar-entries`: the entries, repeats, single-day changes, links and the admin screens.
- `calendar-views`: the public month calendar page on phones and the Calendar slide on TVs.

### Modified Capabilities
- `admin-activity`: new kinds of recorded change for calendar entries.

## Impact

- **Depends on** `tv-screens-and-playlists` being built first: it adds `calendar` to the slide kinds (plain text, so no change to that change's tables) and the slide's content to the public TV feed.
- **Database:** new tables `calendar_entries` and `calendar_exceptions` (one migration). Staging first; call out before pushing.
- **API:** `GET /public/calendar?month=YYYY-MM` (no sign-in) and admin routes for entries and single-day changes; a shared occurrence builder in `packages/shared` used by the API, the page and the TV slide.
- **Shared:** types, schemas, the occurrence builder and new Activity kinds.
- **Dashboard:** the Calendar tab (public and signed-in menu shells), the TV slide, and admin screens under More.
- **Privacy:** public data only; no emails or picks. Links are limited to pages in the app or `https://` addresses.
- **Tests:** unit tests for the repeat rules (month ends, 5th weekday, daylight saving), API tests, and a browser spec.
