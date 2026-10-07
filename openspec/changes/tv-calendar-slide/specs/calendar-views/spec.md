## Purpose

How the calendar is shown to people: a week list on phones for anyone, and a full-screen "next 7 days" slide on the brewery's TVs. There is no month grid for now.

## ADDED Requirements

### Requirement: The public calendar page
The system SHALL show, at `/menu/calendar` with no sign-in (and inside the app shell for signed-in players), a Calendar tab beside Drinks, Kitchen and Music. It SHALL show 7 days starting today (in the brewery's time) as a vertical list of days, each with its entries, with previous and next arrows that move 7 days at a time and a way back to today in one tap. The first day shown SHALL be kept in the address so a link opens it directly. Each entry SHALL show its title, time, type, note and, when it has one, its link as a button. Today SHALL be marked and a quiet day SHALL say "Nothing planned". The data SHALL be one public request per 7 days shown, never cached stale.

#### Scenario: Opening it
- **WHEN** a visitor opens the Calendar tab on a Wednesday
- **THEN** they see Wednesday to the following Tuesday, Wednesday marked as today, each day with its entries or "Nothing planned"

#### Scenario: Order within a day
- **WHEN** a day has several entries
- **THEN** all-day entries come first, then the rest by start time

#### Scenario: Looking ahead
- **WHEN** a visitor taps next
- **THEN** the following 7 days show, including repeating entries that fall in them, and one tap on today brings them back

#### Scenario: A cancelled day
- **WHEN** a day of a series was cancelled
- **THEN** it does not appear on that day

#### Scenario: Following a link
- **WHEN** a visitor taps an entry's link to an in-app page
- **THEN** that page opens; for an `https://` address it opens in a new tab

### Requirement: The Calendar slide
The system SHALL offer "Calendar" as a slide kind for TV playlists. It SHALL show the next 7 days starting today, in the brewery's time, as seven day cards across the TV canvas, each with the day name and date, and its entries as large lines with their time and a small tag with the type's name and colour. Today's card SHALL be highlighted. A quiet day SHALL say "Nothing planned". A day with more entries than fit SHALL end with "+N more". Links SHALL NOT be shown as buttons. The slide SHALL follow the date automatically without anyone changing it.

#### Scenario: Seven days
- **WHEN** the slide shows on Wednesday
- **THEN** the cards run from Wednesday to the following Tuesday, with Wednesday highlighted

#### Scenario: A busy day
- **WHEN** a day has six entries and four fit
- **THEN** four show and the card ends with "+2 more"

#### Scenario: A new day starts
- **WHEN** midnight passes while the TV is showing the slide
- **THEN** on its next refresh the cards start from the new day

#### Scenario: A quiet week
- **WHEN** no entries fall in the next 7 days
- **THEN** the slide is skipped instead of showing seven empty cards

#### Scenario: Colour is not the only signal
- **WHEN** the slide is viewed in greyscale
- **THEN** each type is still distinguishable by its tag text

### Requirement: Only public information
The public calendar feed and the TV slide SHALL contain only entry details and music events: no emails, no picks and no person's details.

#### Scenario: Feed contents
- **WHEN** the public calendar is requested
- **THEN** the response contains only titles, dates, times, types, notes and links
