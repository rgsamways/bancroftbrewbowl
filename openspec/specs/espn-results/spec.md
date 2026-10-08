# espn-results Specification

## Purpose
Let an admin check ESPN for finished games, review them, and apply them so they are saved and scored exactly like hand-entered results, with a record in Activity and no overwriting of results already entered.

## Requirements

### Requirement: Preview finished results from ESPN
The system SHALL provide `GET /admin/results/espn`, for an admin only (401 signed out, 403 for a player), that asks ESPN about the weeks of the latest season that have kicked off and still have an undecided game, and returns, without changing anything: the games that are final on ESPN but undecided here (with week, teams, result and scores), the games already decided here that ESPN reports differently, and the time of the check. When ESPN cannot be reached or answers unusably, it SHALL answer 502 with a plain message and change nothing.

#### Scenario: Games finished
- **WHEN** an admin checks and six games are final on ESPN and undecided here
- **THEN** the answer lists those six with their results and scores, and nothing is saved

#### Scenario: Nothing new
- **WHEN** every final game on ESPN is already decided here
- **THEN** the list is empty

#### Scenario: Disagreement is reported, not applied
- **WHEN** a game was decided by hand as a home win and ESPN says away win
- **THEN** it appears under "differs" and is not changed

#### Scenario: ESPN down
- **WHEN** ESPN does not answer in time
- **THEN** the answer is 502 with a message to enter results by hand, and no game changes

### Requirement: Apply the results as hand-entered results are
The system SHALL provide `POST /admin/results/espn/apply` for an admin, taking the ids of games from the preview. It SHALL fetch ESPN again itself and apply only the listed games that are still undecided here and still final on ESPN, ignoring any result sent by the browser. Each applied game SHALL be saved with its score and scored for every pool in that season exactly as a hand-entered result is (eliminations, mulligans, held wipeouts, pick 'em points). A decided game SHALL never be overwritten. The answer SHALL say which games were applied, which were skipped and why, and whether any wipeout now needs a decision.

#### Scenario: Eliminations follow
- **WHEN** an admin applies a game whose losing team a player picked in a survivor pool
- **THEN** that player is eliminated as if the result had been entered by hand

#### Scenario: Wipeout is held
- **WHEN** applying a game would eliminate every remaining player in a pool
- **THEN** the eliminations are held for an admin decision and the answer says a wipeout is waiting

#### Scenario: Stale preview
- **WHEN** one listed game was decided by hand after the preview
- **THEN** it is skipped as already decided and the others are applied

#### Scenario: Not final
- **WHEN** a listed game is no longer final on ESPN
- **THEN** it is skipped

#### Scenario: Players cannot
- **WHEN** a player calls either route
- **THEN** the request is refused and nothing changes

### Requirement: One record in Activity per import
Each apply that changes at least one game SHALL write one Activity record naming the signed-in admin, saying how many results were imported from ESPN and which games, and flagged when it changed the admin's own entry. An apply that changes nothing SHALL write no record.

#### Scenario: Recorded
- **WHEN** an admin applies four results
- **THEN** Activity shows one record "imported 4 results from ESPN" under that admin's name

### Requirement: No automatic updates
Results SHALL be fetched from ESPN only when an admin asks; there is no scheduled or background fetching.

#### Scenario: Idle
- **WHEN** nobody taps Check for results
- **THEN** the system never contacts ESPN for results

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
