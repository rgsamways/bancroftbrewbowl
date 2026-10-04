# music-events Specification

## Purpose
A list of live music and events that anyone can read, kept current by admins.

## Requirements

### Requirement: The music list is public
The system SHALL provide `GET /public/music`, answering without a session, with the events happening this weekend and the events coming up, each with its title, date and optional start and end time. It SHALL NOT include past events or any information about users or admins.

#### Scenario: Signed out
- **WHEN** a request with no session asks for the public music list
- **THEN** it receives the events and no sign-in is required

#### Scenario: Past events
- **WHEN** an event's date is before today (Eastern time)
- **THEN** it is not in the public list

#### Scenario: No events
- **WHEN** there are no upcoming events
- **THEN** both lists are empty and the page says nothing is scheduled yet

### Requirement: This weekend and coming up
The system SHALL treat Friday to Sunday as the weekend, using today's date in Eastern time. From Monday to Thursday "this weekend" SHALL be the coming Friday to Sunday; from Friday to Sunday it SHALL be the current Friday to Sunday, with days already gone dropped. Every other event from today on SHALL be "coming up". Both lists SHALL be in date and start-time order.

#### Scenario: Midweek
- **WHEN** it is Wednesday and events exist on Friday, Saturday and the Friday after
- **THEN** the first two are this weekend and the last is coming up

#### Scenario: Saturday
- **WHEN** it is Saturday and an event was on Friday
- **THEN** Friday's event is not shown and Saturday's and Sunday's are this weekend

#### Scenario: A weekday event
- **WHEN** an event is on a Tuesday
- **THEN** it is under coming up

### Requirement: Music page
The system SHALL show the music list as a Music tab beside Drinks and Kitchen at `/menu/music` for signed-out visitors and signed-in players. An event with no start time SHALL read "Time to be confirmed"; one with times SHALL read like "1 – 4 PM".

#### Scenario: Visitor from a QR code
- **WHEN** a signed-out person opens `/menu/music`
- **THEN** they see the music list without being sent to sign in

#### Scenario: Times
- **WHEN** an event runs 1:00 to 4:00 PM
- **THEN** it shows "1 – 4 PM"

### Requirement: Only admins change the music list
The system SHALL let only admins add, edit and remove events, answering 401 when signed out and 403 for players, and SHALL record each change in Activity with who made it, never held for another admin's confirmation.

#### Scenario: A player tries
- **WHEN** a signed-in player sends a music change
- **THEN** it is refused with 403 and nothing changes

#### Scenario: Recorded
- **WHEN** an admin adds, changes or removes an event
- **THEN** Activity shows one record naming the admin and the event

### Requirement: Events are validated
The system SHALL refuse an event with no title, a title over 80 characters, a date that is not a real calendar date, a time that is not `HH:MM`, an end time with no start time, or an end time not later than the start time, and SHALL accept an event with only a title and a date.

#### Scenario: Minimal event
- **WHEN** an admin adds a title and a date only
- **THEN** it is saved with no times

#### Scenario: Impossible date
- **WHEN** an admin sends 2026-02-31
- **THEN** the server refuses it

### Requirement: Admin Music screens
The system SHALL give admins a Music tab in the admin Menu with "Add music or an event", a Coming up list and a Past list, a three-step wizard to add an event (who is playing; when, with quick choices for the coming Friday, Saturday and Sunday, another date, and optional start and end times; review), an edit screen, and a Remove that asks first. The wizard SHALL end with a screen that says the event is on the schedule and offers "Back to the music" and "Add another". All SHALL fit a 390 pixel wide screen.

#### Scenario: Add a band
- **WHEN** an admin completes the wizard
- **THEN** it appears in the admin list and on the public music page straight away

#### Scenario: Remove
- **WHEN** an admin removes an event after confirming
- **THEN** it is gone from both lists
