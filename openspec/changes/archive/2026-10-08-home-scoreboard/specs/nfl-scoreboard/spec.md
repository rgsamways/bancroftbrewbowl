## ADDED Requirements

### Requirement: One cached scoreboard for everyone
The system SHALL provide `GET /me/scoreboard`, for a signed-in player only (401 signed out), returning the current week's NFL games from ESPN: for each game its teams, kickoff, state (upcoming, live or final), a short status text (for example "Q3 4:21", "Halftime", "Final", "Postponed"), both scores once it has started, each team's record, and the TV network; plus the teams on a bye and the time the answer was read. The current week SHALL be the same one Home uses. ESPN SHALL be read at most once at a time and the answer SHALL be cached for a short time while a game is live, and longer when nothing is on, so many players never mean many requests to ESPN.

#### Scenario: Signed out
- **WHEN** the scoreboard is requested without a session
- **THEN** the request is refused as not signed in

#### Scenario: Live games
- **WHEN** a game is in progress
- **THEN** it is listed as live with its score and quarter and clock

#### Scenario: Many requests
- **WHEN** many players request the scoreboard within the cache time
- **THEN** ESPN is read once

### Requirement: ESPN trouble does not break the scoreboard
When ESPN cannot be read, the system SHALL serve the last good scoreboard for up to an hour, marked as stale with the time it was read, and after that SHALL answer that there is no scoreboard. It SHALL never answer with an error the player has to see.

#### Scenario: ESPN down briefly
- **WHEN** ESPN fails after a good read ten minutes ago
- **THEN** the last scoreboard is returned, marked stale with its time

#### Scenario: ESPN down for long
- **WHEN** there is no good read from the last hour
- **THEN** the answer has no games, and the app shows no scoreboard

### Requirement: Only the player's own picks, and no odds
The scoreboard answer SHALL include, for the signed-in player's alive entries, the teams they picked this week, and SHALL NOT include anyone else's picks, names or counts. It SHALL NOT include betting odds, spreads or lines, or ESPN's logos.

#### Scenario: Own picks
- **WHEN** a player picked the Chiefs this week
- **THEN** the answer lists the Chiefs among that player's picks for that pool, and nothing about other players

#### Scenario: No odds
- **WHEN** ESPN's feed contains odds
- **THEN** none of it appears in the answer
