## ADDED Requirements

### Requirement: Home shows the NFL scoreboard
Home SHALL show, under the hero, a scoreboard of the current week's games: live games first with the score, quarter and clock; then upcoming games with the kickoff time and TV network; then finished games with the final score. Each team SHALL have its colour circle and record, and the teams on a bye SHALL be listed. The games the player picked SHALL be marked "Your pick" (only their own picks). Past the first six games a "Show all" control SHALL reveal the rest. The section SHALL say when it was last updated and that scores can lag a little, and SHALL be hidden when there is no scoreboard.

#### Scenario: A live game
- **WHEN** a game is in the third quarter
- **THEN** its row shows both scores and "Q3 4:21", and is listed before upcoming and finished games

#### Scenario: Own pick
- **WHEN** the player picked the Chiefs and the Chiefs are playing
- **THEN** that game is marked "Your pick" on the Chiefs

#### Scenario: Nothing to show
- **WHEN** there is no scoreboard (ESPN down for long, or no games)
- **THEN** Home shows no scoreboard section and no error

### Requirement: The scoreboard refreshes itself sensibly
The scoreboard SHALL refresh about every 30 seconds while any game is live and every few minutes otherwise, SHALL not refresh while the tab is hidden, and SHALL refresh when the tab becomes visible again.

#### Scenario: Hidden tab
- **WHEN** the tab is in the background
- **THEN** no scoreboard requests are made
