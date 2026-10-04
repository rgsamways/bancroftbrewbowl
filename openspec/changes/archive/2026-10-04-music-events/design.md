## Context

Mockups: `menu-music`, `admin-events`, `admin-step-event-1..3/done`. The Menu tab, public frame, admin Menu list and the `admin-menu` wizard pattern exist from `menu-items`. Admin writes follow `routes/menu.ts`: `requireAdmin`, Zod body, `recordActivity` in the same transaction.

## Decisions

- **Table `music_events`:** `id`, `title` (text), `event_date` (date), `start_time` (time, null), `end_time` (time, null), `created_at`, `updated_at`. Times are Eastern wall-clock as the brewery thinks of them, so there is no time zone maths. An event with no start time shows "Time to be confirmed". "Band to be announced" is just a title with a date.
- **Today and the weekend.** The server works out today's date in Eastern time (`Intl` with `America/Toronto`, in `packages/shared/src/game-time.ts` beside the existing helpers, pure and unit tested). "This weekend" is Friday to Sunday: from Monday to Thursday it is the coming Friday to Sunday; from Friday to Sunday it is the current Friday to Sunday, and days already gone drop off. Anything else on or after today is "Coming up". Anything before today is Past.
- **Public read.** `GET /public/music` needs no session and returns `{ thisWeekend: Event[], comingUp: Event[] }` with title, date, start and end time only. Past events are never in it. Sent with `Cache-Control: public, max-age=0, must-revalidate`, like the menu.
- **Admin routes.** `GET /music/events` (admin: `{ comingUp, past }`, past newest first), `POST /music/events`, `PATCH /music/events/:id`, `DELETE /music/events/:id`. All `requireAdmin` and `recordActivity` (kinds `music_event_added|changed|removed`, category `menu`, so the Activity "Menu" filter shows them). They never need a second admin's confirmation.
- **Validation.** Title 1 to 80 characters. Date must be a real calendar date (`YYYY-MM-DD`). Times are `HH:MM` 24-hour. An end time needs a start time and must be later than it. Dates in the past are allowed on edit but the add wizard offers today onward.
- **Screens.** Public and signed-in: a Music sub-tab (`/menu/music`) with "This weekend" and "Coming up" lists and a friendly empty state. Admin: the admin Menu gets a Music sub-tab (`?tab=music`) with Add music or an event, Coming up, Past; a three-step wizard in `FocusLayout` (who; when with day chips for the coming Fri/Sat/Sun plus "Another date" and optional start and end times; review) then a done screen with "Back to the music / Add another"; the edit screen has Save and Remove (asks first).
- **No seed data and no test data in production.** Tests clean up their own rows.

## Risks

- A bad migration blocks the deploy: run it on staging's own database first.
- The weekend rule depends on the Eastern date, not the server's; unit tests cover each weekday and a date near midnight UTC.
- Daylight saving: dates and wall-clock times are stored as typed, so there is nothing to shift.
