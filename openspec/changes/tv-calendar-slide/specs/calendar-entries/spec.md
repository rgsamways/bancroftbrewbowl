## Purpose

Dated entries the brewery wants to show on a calendar (bands, specials, events, closures), with simple repeats and one-day changes, managed by any admin.

## ADDED Requirements

### Requirement: Calendar entries
The system SHALL let any admin add, edit and remove calendar entries. An entry SHALL have a title (1 to 80 characters), a date, an optional start time and end time, a type (Music, Food special, Drink special, Event, Closed or Other), an optional note (up to 300 characters), and an optional link. Dates and times SHALL be the brewery's local (Eastern) time. A player or signed-out visitor SHALL be refused every write.

#### Scenario: Adding an entry
- **WHEN** an admin adds "Taco Tuesday", type Food special, on a date, with no time
- **THEN** the entry shows on that day on the calendar with no time

#### Scenario: End before start
- **WHEN** an admin saves an end time earlier than the start time
- **THEN** the save is refused with a clear message

#### Scenario: Not an admin
- **WHEN** a player calls an entry write route
- **THEN** it is refused (403) and nothing changes

### Requirement: Links are safe
An entry's link SHALL be either a page in the app (the menu, drinks, kitchen, music, help, sign-up, or a chosen pool) or a web address beginning `https://`. Any other form (including `http://`, `javascript:` and relative addresses typed by hand) SHALL be refused. A link SHALL have a short label (up to 30 characters, default "Learn more").

#### Scenario: A script address
- **WHEN** an admin saves a link of `javascript:alert(1)`
- **THEN** the save is refused

#### Scenario: A pool link
- **WHEN** an admin links an entry to a pool and the pool is later deleted
- **THEN** the entry stays and shows without the link

### Requirement: Simple repeats
An entry SHALL repeat as one of: just this day, every week, every 2 weeks, or monthly on the same weekday (for example the 2nd Friday; the 5th of a weekday falls only in months that have one). A repeating entry SHALL have an optional end date. Occurrences SHALL be worked out when requested; none SHALL be stored per day. No other repeat pattern SHALL be offered.

#### Scenario: Every week
- **WHEN** "Trivia" is set to every week from Tuesday the 6th
- **THEN** it appears on every Tuesday from the 6th, and not before

#### Scenario: Every 2 weeks
- **WHEN** "Run club" repeats every 2 weeks from the 3rd
- **THEN** it appears on the 3rd, 17th and 31st, and not on the 10th or 24th

#### Scenario: Monthly on the 2nd Friday
- **WHEN** an entry repeats monthly on the 2nd Friday of its start date
- **THEN** it appears on the 2nd Friday of each month, including across a daylight saving change, and only in months where that Friday exists

#### Scenario: End date
- **WHEN** a repeating entry has an end date
- **THEN** no occurrence appears after that date

### Requirement: Changing one day of a repeat
The system SHALL let an admin change or cancel a single day of a repeating entry without changing the other days, and SHALL ask "just this day" or "all in the series" when editing a repeating entry. Cancelling one day SHALL leave the rest unchanged. Removing a whole series SHALL remove its single-day changes with it.

#### Scenario: Cancel one Tuesday
- **WHEN** an admin cancels "Trivia" on one Tuesday
- **THEN** that Tuesday no longer shows it and every other Tuesday still does

#### Scenario: Change one day's time
- **WHEN** an admin changes the start time for one day only
- **THEN** only that day shows the new time

#### Scenario: Edit all
- **WHEN** an admin edits a series with "all in the series"
- **THEN** every day that has no single-day change shows the new details, and days with a single-day change keep theirs

### Requirement: Music events appear without being re-entered
The calendar SHALL include every music event already entered, as a Music entry for its date and times, and these SHALL be changed only through Music, not through calendar entries.

#### Scenario: A band is entered once
- **WHEN** an admin adds a music event for Saturday
- **THEN** it appears on Saturday's calendar with no second entry needed

### Requirement: Admin screens for the calendar
The system SHALL give admins a Calendar area under More with a month list of entries (music events shown but marked "from Music"), an add and edit form (title, date, times, type, note, link, repeat, end date), the "just this day or all" choice for repeats, and a way to cancel or remove. It SHALL use plain wording and fit a phone 390 wide.

#### Scenario: Reaching it
- **WHEN** an admin opens More
- **THEN** they can open Calendar and see the current month's entries

#### Scenario: Not for players
- **WHEN** a player opens the admin calendar address
- **THEN** they are sent away and shown nothing
