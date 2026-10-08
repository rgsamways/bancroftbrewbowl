## MODIFIED Requirements

### Requirement: Each open pool has a join page
The system SHALL give each pool a join page showing its name, kind and season, a short "How this pool works" list in plain words (survivor: one pick a week, each team once, a loss or tie puts you out, picks lock at kickoff; pick 'em: a point for each right pick, you can't be knocked out, a tied game doesn't score, picks lock at kickoff), a line "You'll join as <name>" with a "Change" link to the Me page, and the buttons "Join <pool>" and "Not now". When the account has no display name yet (its name is still its email address), the page SHALL instead ask "What should other players call you?" with a name field, and SHALL NOT let them join until a name is saved, so a new player is never shown to others as an email address.

#### Scenario: Joining
- **WHEN** a player taps "Join Sunday Survivor"
- **THEN** they are in the pool and land on their pick screen for it

#### Scenario: Not now
- **WHEN** a player taps "Not now"
- **THEN** they return to Home and are not in the pool

#### Scenario: Already in the pool
- **WHEN** a player already in the pool opens its join page
- **THEN** they are taken to their entry instead of joining twice

#### Scenario: Name line
- **WHEN** the join page is shown to an account that has a display name
- **THEN** the name shown is the name on their account, and "Change" opens the Me page

#### Scenario: A new account with no display name
- **WHEN** a new person opens the join page and their account name is still their email
- **THEN** the page asks for a display name first, and after they save one it shows "You'll join as <that name>" and the Join button

#### Scenario: No name given
- **WHEN** they try to join without saving a name
- **THEN** they cannot join and are asked for a name
