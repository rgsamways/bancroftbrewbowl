## ADDED Requirements

### Requirement: Load a season's schedule from a screen
The god-user SHALL be able to choose a season on the Schedule screen and see a preview of what loading it from ESPN would do: games to add, and games whose kickoff time differs. Applying SHALL insert new games as undecided and update the kickoff of games that have not started, and SHALL NOT set or change any result or the kickoff of a game that has started or has a result. The result SHALL be recorded in Activity under the god-user's name. If ESPN cannot be reached it SHALL say so and change nothing.

#### Scenario: A new season
- **WHEN** the god-user previews and applies a season that has no games
- **THEN** its regular-season games are added as undecided

#### Scenario: A flexed game
- **WHEN** one stored game's kickoff differs from ESPN and it has not started
- **THEN** the preview lists it and applying updates its kickoff

#### Scenario: A started game
- **WHEN** ESPN reports a different kickoff for a game that has started
- **THEN** it is left alone

#### Scenario: Not the god-user
- **WHEN** an admin who is not the god-user calls the schedule routes
- **THEN** the request is refused
