## ADDED Requirements

### Requirement: Moved kickoffs are shown and applied
Check for results SHALL also list games whose kickoff time on ESPN differs from the stored one by more than a minute, for games that have not started and have no result, in the current week and the next two weeks, showing the old and new time. Applying SHALL update those kickoffs and SHALL NOT change the kickoff of a game that has started or has a result. The Activity record for the import SHALL say how many kickoffs moved. Nothing runs without an admin asking.

#### Scenario: A game is flexed
- **WHEN** a Sunday afternoon game has been moved to Monday night on ESPN
- **THEN** Check for results lists it as moved, and applying it updates the stored kickoff so its pick lock follows the new time

#### Scenario: Started game
- **WHEN** ESPN reports a different kickoff for a game that has already started
- **THEN** the stored kickoff is left alone

### Requirement: Any day of the week
Locks, states and screens for picks SHALL work for games on any day, including Wednesday, Friday and Saturday games and a week whose first game is not on a Thursday.

#### Scenario: A Friday game opens a week
- **WHEN** a week's first game is on a Friday and the rest follow on Sunday and Monday
- **THEN** in a per-game pool the Friday teams lock at their kickoff and the Sunday and Monday teams stay open, and in a whole-week pool the week locks at the Friday kickoff
