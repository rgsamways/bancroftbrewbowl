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
*Alternative:* store one row per day. Simpler to query, but "edit the series" and "end date" then mean rewriting rows, and it invites a job to extend them. Computing is cheap for a week.

**2. A pure occurrence builder in `packages/shared`.** `occurrencesForRange(entries, exceptions, musicEvents, from, days)` returns `days` consecutive days (7 for the phone page and the TV) with ordered entries. Dates are plain `YYYY-MM-DD` strings and the weekday and week arithmetic is done on calendar dates (never on instants), so daylight saving cannot shift anything. Rules: weekly = same weekday every 7 days from the anchor; biweekly = every 14 days from the anchor; monthly_weekday = the same "nth weekday" as the anchor (the 5th only in months that have one). Exceptions override or cancel a day if the day is a real occurrence; an exception for a non-occurrence is ignored. Heavy unit tests here (month and year ends inside a range, leap day, 5th weekday, biweekly across a month boundary, until date inclusive, exception on the anchor day).

**3. Music is merged at read time**, not copied. The builder takes music events as another input, tagged type Music with `fromMusic: true`, so the admin list can mark them "from Music" and make them read-only.

**4. Links.** `link_kind` is `app` or `url`. For `app`, `link_target` is one of a fixed list (`menu`, `drinks`, `kitchen`, `music`, `calendar`, `help`, `signup`, `pool:<id>`) resolved to a path by a shared helper; a deleted pool just drops the link at read time. For `url`, a Zod rule requires a parseable `https://` URL under 300 characters; everything else is refused. External links open with `rel="noopener noreferrer"` in a new tab. The server validates; the client never builds a link from raw text.

**5. API.** `GET /public/calendar?from=YYYY-MM-DD` (no sign-in, `Cache-Control: no-store`, always 7 days, `from` limited to 2 years either side of today) returns the ready days, so the phone page and the TV feed share the builder's output. Admin routes: `GET /calendar/entries?from=`, `POST /calendar/entries`, `PATCH /calendar/entries/:id` (all), `DELETE /calendar/entries/:id` (all), `PUT /calendar/entries/:id/days/:date` (change one day) and `DELETE /calendar/entries/:id/days/:date` (cancel that day, written as a cancelled exception). Editing a one-off entry uses the same routes. Every write calls `recordActivity` with new kinds (`calendar_entry_added`, `_changed`, `_removed`, `_day_changed`, `_day_cancelled`, category `content`); the coverage test must pass with no exceptions.

**6. Screens.** There is no month grid anywhere for now (cramped on a phone, tacky on a TV). Phone page: a vertical list of 7 days starting at `from` (default today), each day a header ("Today", "Tomorrow" or the weekday and date) with its entries underneath or "Nothing planned"; type tag with text plus colour; previous and next arrows step 7 days and a Today button returns; `from` in the address (`/menu/calendar?from=2026-10-14`) so a week can be shared. The TV slide is seven day cards across the 1280 by 664 area, each card showing as many large lines as fit (a fixed count, then "+N more"), today highlighted, past never shown. The TV feed from `tv-screens-and-playlists` gets a `calendar` slide whose content is the next 7 days, computed from "today" in the brewery's time on every request, so it moves on at midnight with no one changing it. The slide counts as empty (and is skipped) when those 7 days have no entries. A month view can be added later without changing the data.

**7. Admin screens** under More > Calendar: list of entries for 7 days at a time with previous and next, add and edit as a short form (not a long wizard), a repeat picker with the four choices only, and for a repeating entry a plain choice "Just this day" or "All in the series". Wording avoids jargon.

## Risks / Trade-offs

- [Repeat rules get requested to grow] → Four choices only; anything else is a later change with its own tests.
- [Date arithmetic bugs at month ends or around daylight saving] → Pure date strings, one tested builder, no instants.
- [Two changes edit the same admin-activity requirement] → The calendar delta carries the TV wording too, so whichever archives second keeps both; check the merged text when syncing.
- [External links on a public page] → https only, `noopener noreferrer`, validated on the server, no raw HTML anywhere in titles or notes (plain text).
- [A busy day is unreadable on a TV] → Fixed line limit with "+N more"; the full list is on the phone page.
- [Depends on the TV change] → Build order: `tv-screens-and-playlists` first; the phone page and admin screens can ship without the TV slide if the TV change is delayed.

## Migration Plan

One additive migration (two tables). Staging first, check `GET /public/calendar` on the staging API; production's preDeploy migrates on push. Rollback is leaving the tables unused.

## Open Questions

- Which in-app destinations Lark wants first beyond the fixed list (the list is easy to extend without a migration).
