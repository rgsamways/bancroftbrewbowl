## ADDED Requirements

### Requirement: Home asks for a display name when there isn't one
Home SHALL show a "What should we call you?" card whenever the signed-in account's name is empty or contains an "@". Saving a name SHALL set the account's display name (the same one as on the Me page) and the card SHALL then disappear. The card SHALL NOT block joining a pool or picking. Champion names on Home SHALL follow the same safe-name rule as Standings.

#### Scenario: No real name yet
- **WHEN** a player whose account name is their email opens Home
- **THEN** the card is shown, and after saving "Lark P." it is gone and Standings shows "Lark P."

#### Scenario: Already named
- **WHEN** a player's name is "Robin S."
- **THEN** no card is shown
