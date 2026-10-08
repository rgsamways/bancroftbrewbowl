## MODIFIED Requirements

### Requirement: The Pick tab goes where the player needs to be
The system SHALL, when the Play tab has no remembered pool screen, take a player to the pick screen of the entry that needs attention (the same choice as Home), and show "You haven't joined a pool yet" with "Go to Home" to a player in no pool. A player whose entries are all out SHALL be taken to their most recent entry's "Your season" view. The pool's Pick tab SHALL always open that entry's pick screen.

#### Scenario: One pool needing a pick
- **WHEN** a player with one alive entry taps Play for the first time
- **THEN** they land on that entry's pick screen

#### Scenario: In no pool
- **WHEN** a player in no pool taps Play
- **THEN** they see "You haven't joined a pool yet" and a link to Home
