## ADDED Requirements

### Requirement: The TV page uses the same safe names
The alive names and the leaderboard names on the TV data SHALL follow the same rule as Standings: a name that is empty or contains an "@" is shown as the part before the "@", or "A player".

#### Scenario: Unnamed player on the TV
- **WHEN** a player's account name is an email address
- **THEN** the TV data lists only the part before the "@"
