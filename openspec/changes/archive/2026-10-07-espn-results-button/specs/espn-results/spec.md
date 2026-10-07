## ADDED Requirements

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
