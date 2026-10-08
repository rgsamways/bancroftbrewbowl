## MODIFIED Requirements

### Requirement: Home shows the NFL scoreboard
Home SHALL show, under the hero, a scoreboard of the current week's games: live games first with the score, quarter and clock; then upcoming games with the kickoff time and TV network; then finished games with the final score. Each team SHALL have its colour circle and record, and the teams on a bye SHALL be listed. A team the player picked SHALL have a subtle tint on its row and a small "Your pick" chip beside its name, reading "Your pick ×N" when the team was picked in N (two or more) of their pools; pool names SHALL NOT be shown on the scoreboard, the chip SHALL NOT shorten the team name, and only the player's own picks SHALL be marked. Past the first six games a "Show all" control SHALL reveal the rest. The section SHALL say when it was last updated and that scores can lag a little, and SHALL be hidden when there is no scoreboard.

#### Scenario: A live game
- **WHEN** a game is in the third quarter
- **THEN** its row shows both scores and "Q3 4:21", and is listed before upcoming and finished games

#### Scenario: Own pick
- **WHEN** the player picked the Chiefs in one pool and the Chiefs are playing
- **THEN** the Chiefs row is tinted and shows a "Your pick" chip beside the name, with no pool name

#### Scenario: Picked in several pools
- **WHEN** the player picked the Texans in two pools
- **THEN** the Texans row shows "Your pick ×2" and the full team name is still visible

#### Scenario: Nothing to show
- **WHEN** there is no scoreboard (ESPN down for long, or no games)
- **THEN** Home shows no scoreboard section and no error
