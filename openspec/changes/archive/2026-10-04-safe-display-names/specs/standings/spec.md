## ADDED Requirements

### Requirement: Player names never show an email address
A player's name on Standings SHALL be their display name, except that a name that is empty or contains an "@" SHALL be shown as the part before the "@", or "A player" when nothing is left. This SHALL hold for every row, for both pool types.

#### Scenario: A player who never set a name
- **WHEN** a player's account name is `lark@example.com`
- **THEN** Standings shows `lark`, and the address appears nowhere in the answer

#### Scenario: A normal name
- **WHEN** a player's name is `Robin S.`
- **THEN** it is shown unchanged
