## Purpose

How the calendar is shown to people: an interactive month on phones for anyone, and a full-screen month slide on the brewery's TVs.

## ADDED Requirements

### Requirement: The public calendar page
The system SHALL show, at `/menu/calendar` with no sign-in (and inside the app shell for signed-in players), a Calendar tab beside Drinks, Kitchen and Music. It SHALL show the current month in the brewery's time, a grid of days, previous and next month arrows, and a way back to the current month. A day with entries SHALL show a small mark per type and SHALL be tappable, opening a list of that day's entries with title, time, type, note and the entry's link as a button when it has one. Today SHALL be marked. The data SHALL be one public request per month, never cached stale.

#### Scenario: Opening it
- **WHEN** a visitor opens the Calendar tab
- **THEN** they see the current month with today marked and marks on days that have entries

#### Scenario: Tapping a day
- **WHEN** a visitor taps a day with two entries
- **THEN** the list shows both, ordered by time (all-day entries first), and a linked entry shows its button

#### Scenario: Looking ahead
- **WHEN** a visitor taps next month
- **THEN** the next month shows, including repeating entries that fall in it, and they can return to the current month in one tap

#### Scenario: A cancelled day
- **WHEN** a day of a series was cancelled
- **THEN** it does not appear on that day

#### Scenario: Following a link
- **WHEN** a visitor taps an entry's link to an in-app page
- **THEN** that page opens; for an `https://` address it opens in a new tab

### Requirement: The Calendar slide
The system SHALL offer "Calendar" as a slide kind for TV playlists. It SHALL show the current month, in the brewery's time, as a full-screen grid on the TV canvas, with each entry's title (and time when it has one) and a small colour tag per type, and "+N more" when a day has more entries than fit. Links SHALL NOT be shown as buttons. The slide SHALL follow the new month automatically without anyone changing it. A month with no entries SHALL still show the grid.

#### Scenario: Month with a busy day
- **WHEN** a day has six entries and four fit
- **THEN** four show and the cell says "+2 more"

#### Scenario: A new month starts
- **WHEN** the TV is showing the slide as the month changes
- **THEN** on its next refresh it shows the new month

#### Scenario: Colour is not the only signal
- **WHEN** the slide is viewed in greyscale
- **THEN** each type is still distinguishable by its tag text

### Requirement: Only public information
The public calendar feed and the TV slide SHALL contain only entry details and music events: no emails, no picks and no person's details.

#### Scenario: Feed contents
- **WHEN** the public calendar is requested
- **THEN** the response contains only titles, dates, times, types, notes and links
