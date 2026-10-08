## ADDED Requirements

### Requirement: The Pick screen for a part-locked week
In a per-game pool the Pick screen SHALL keep working while some games have started: a game that has started SHALL show as started (with its result when it has one) and its teams SHALL not be selectable, while games that have not started stay selectable and a pick for them can be changed. A pick whose game has started SHALL show as locked. The whole screen SHALL be replaced by the "Picks are locked" view only when nothing in the week can still be picked or changed. The header SHALL say when the next game locks.

#### Scenario: Thursday done, Sunday open
- **WHEN** the Thursday game has started and the Sunday games have not
- **THEN** Thursday's teams are shown as started, Sunday's teams can still be picked, and the header shows the next lock

#### Scenario: Everything started
- **WHEN** every game of the week has started
- **THEN** the screen shows the picks locked view

#### Scenario: Whole-week pool
- **WHEN** a pool locks at the week's first kickoff
- **THEN** the screen behaves as before
