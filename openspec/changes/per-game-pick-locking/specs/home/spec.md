## ADDED Requirements

### Requirement: Home states for a part-locked week
For an entry in a per-game pool, Home SHALL treat the entry as locked only when its own picks can no longer change or nothing more can be picked: a survivor entry whose pick's game has started, or any entry in a week where every game has started. Otherwise it SHALL be "needs picks" or "picked", and the countdown SHALL be to the next lock that matters to the entry: its own pick's kickoff when it has one, else the next kickoff of a game still open. Pools using the whole-week rule SHALL be unchanged.

#### Scenario: Picked, game not started
- **WHEN** a survivor picked a Sunday team and the Thursday game has started
- **THEN** Home shows the entry as picked with a countdown to that Sunday game's kickoff

#### Scenario: Pick's game started
- **WHEN** the survivor's picked team's game has started
- **THEN** Home shows the entry as locked

#### Scenario: Nothing picked, games still open
- **WHEN** an entry has no pick and a later game has not started
- **THEN** Home shows that picks are needed, with a countdown to the next game
