## ADDED Requirements

### Requirement: Help someone sign in
The god-user SHALL be able, from a player's row, to sign that player out everywhere and remove their password, after a confirmation that explains the player will then sign in with an emailed link. It SHALL create or show no password. It SHALL be recorded in Activity under the god-user's name, and SHALL be refused for the god-user's own account.

#### Scenario: A locked-out player
- **WHEN** the god-user confirms Help someone sign in for a player
- **THEN** the player's sessions end and their password is removed, so only the emailed link works for them

#### Scenario: Not the god-user
- **WHEN** another admin calls the route
- **THEN** it is refused
