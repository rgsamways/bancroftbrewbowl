## Context

Music events live in `music_events` (date, optional times) with public and admin routes (`routes/music.ts`) and a Music tab (`/menu/music`, in both `PublicMenuPage` and `MenuPage`, `App.tsx`). Times are stored as local (Eastern) clock values and shown through `packages/shared/src/game-time.ts` conventions. The project computes derived state on demand and has no scheduler. `tv-screens-and-playlists` (planned, not built) defines playlists whose slide `kind` is plain text and a public TV feed that builds each slide's content. See proposal.md for scope.

## Goals / Non-Goals

**Goals:**
- One occurrence builder, used by the API, the phone page and the TV slide, so all three agree.
- Repeats simple enough to explain in one sentence each; one-day changes that never touch other days.
- No double entry for bands.

**Non-Goals:**
- Custom or complex repeats (daily, weekdays, "last Friday", multiple weekdays), reminders, player-submitted entries.
- Folding Music into calendar entries (Music stays its own screens; it is read into the calendar).

## Decisions

**1. Two tables.** `calendar_entries` (id, title, entry_date, start_time, end_time, type, note, link_kind, link_target, link_label, repeat text `none | weekly | biweekly | monthly_weekday`, repeat_until date nullable, timestamps) and `calendar_exceptions` (id, entry_id cascade, exception_date, cancelled bool, plus nullable override fields title, start_time, end_time, type, note, link fields; unique on entry and date). `entry_date` is the first occurrence and the anchor for every rule (weekday, week parity, nth weekday). A repeating entry and its exceptions are the only stored rows; occurrences are computed.
*Alternative:* store one row per day. Simpler to query, but "edit the series" and "end date" then mean rewriting rows, and it invites a job to extend them. Computing is cheap for a month.

**2. A pure occurrence builder in `packages/shared`.** `occurrencesForMonth(entries, exceptions, musicEvents, year, month)` returns days with ordered entries. Dates are plain `YYYY-MM-DD` strings and the weekday and week arithmetic is done on calendar dates (never on instants), so daylight saving cannot shift anything. Rules: weekly = same weekday every 7 days from the anchor; biweekly = every 14 days from the anchor; monthly_weekday = the same "nth weekday" as the anchor (the 5th only in months that have one). Exceptions override or cancel a day if the day is a real occurrence; an exception for a non-occurrence is ignored. Heavy unit tests here (month ends, leap day, 5th weekday, biweekly across a month boundary, until date inclusive, exception on the anchor day).

**3. Music is merged at read time**, not copied. The builder takes music events as another input, tagged type Music with `fromMusic: true`, so the admin list can mark them "from Music" and make them read-only.

**4. Links.** `link_kind` is `app` or `url`. For `app`, `link_target` is one of a fixed list (`menu`, `drinks`, `kitchen`, `music`, `calendar`, `help`, `signup`, `pool:<id>`) resolved to a path by a shared helper; a deleted pool just drops the link at read time. For `url`, a Zod rule requires a parseable `https://` URL under 300 characters; everything else is refused. External links open with `rel="noopener noreferrer"` in a new tab. The server validates; the client never builds a link from raw text.

**5. API.** `GET /public/calendar?month=YYYY-MM` (no sign-in, `Cache-Control: no-store`, month limited to 24 months either side of today) returns the ready days, so the phone page and the TV feed share the builder's output. Admin routes: `GET /calendar/entries?month=`, `POST /calendar/entries`, `PATCH /calendar/entries/:id` (all), `DELETE /calendar/entries/:id` (all), `PUT /calendar/entries/:id/days/:date` (change one day) and `DELETE /calendar/entries/:id/days/:date` (cancel that day, written as a cancelled exception). Editing a one-off entry uses the same routes. Every write calls `recordActivity` with new kinds (`calendar_entry_added`, `_changed`, `_removed`, `_day_changed`, `_day_cancelled`, category `content`); the coverage test must pass with no exceptions.

**6. Screens.** Phone page: a month grid (7 columns), type marks as small dots with an accessible label, a bottom sheet or inline panel for the tapped day, arrows and a "This month" button; month in the address (`/menu/calendar?month=2026-11`) so a day can be shared. The TV slide renders from the feed's pre-built month; each cell shows up to a fixed number of lines that fit the 1280 by 664 area (computed from the number of weeks in the month) and "+N more". Type tags use text plus colour from the existing tokens. The TV feed from `tv-screens-and-playlists` gets a `calendar` slide whose content is the current month's days, and the month rolls over because the feed computes "current month" in the brewery's time on every request.

**7. Admin screens** under More > Calendar: month list with previous and next, add and edit as a short form (not a long wizard), a repeat picker with the four choices only, and for a repeating entry a plain choice "Just this day" or "All in the series". Wording avoids jargon.

## Risks / Trade-offs

- [Repeat rules get requested to grow] → Four choices only; anything else is a later change with its own tests.
- [Date arithmetic bugs at month ends or around daylight saving] → Pure date strings, one tested builder, no instants.
- [Two changes edit the same admin-activity requirement] → The calendar delta carries the TV wording too, so whichever archives second keeps both; check the merged text when syncing.
- [External links on a public page] → https only, `noopener noreferrer`, validated on the server, no raw HTML anywhere in titles or notes (plain text).
- [A busy month is unreadable on a TV] → Fixed line limit with "+N more"; the full list is on the phone page.
- [Depends on the TV change] → Build order: `tv-screens-and-playlists` first; the phone page and admin screens can ship without the TV slide if the TV change is delayed.

## Migration Plan

One additive migration (two tables). Staging first, check `GET /public/calendar` on the staging API; production's preDeploy migrates on push. Rollback is leaving the tables unused.

## Open Questions

- Which in-app destinations Lark wants first beyond the fixed list (the list is easy to extend without a migration).
