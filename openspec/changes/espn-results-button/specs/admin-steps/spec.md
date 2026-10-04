## ADDED Requirements

### Requirement: Results has a Check for results button
The admin Results screen SHALL have a "Check for results" button. Tapping it SHALL show the finished games found ("N games finished") with their teams and scores, an "Apply N results" button, and any games that differ from what was entered by hand (shown, not changed). After applying, the screen SHALL say how many results were saved, and when a wipeout now needs a decision SHALL link to it. When nothing is new it SHALL say "Nothing new to apply." When ESPN cannot be reached it SHALL say so and point to entering results by hand, which remains available below.

#### Scenario: Finished games
- **WHEN** an admin taps Check for results and six games have finished
- **THEN** the six are listed with scores and an "Apply 6 results" button; nothing changes until they tap it

#### Scenario: Applied
- **WHEN** they tap Apply
- **THEN** the screen says the results were saved and the Results list shows those games decided

#### Scenario: Nothing new
- **WHEN** no game has finished since the last update
- **THEN** it says "Nothing new to apply."

#### Scenario: ESPN unavailable
- **WHEN** ESPN cannot be reached
- **THEN** the screen says it could not check, and entering results by hand still works
