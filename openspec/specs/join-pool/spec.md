# join-pool Specification

## Purpose
How a player joins a pool: a page for each pool that explains the rules in plain words before they commit, a page for a pool that has finished, and an offer of Pick 'Em to a survivor player who is out.

## Requirements

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

### Requirement: A finished pool cannot be joined
The system SHALL show, for a pool whose status is completed, "<pool> has finished, so it isn't taking new players." with "See final standings" and "Back to Home", and no join button.

#### Scenario: Completed pool
- **WHEN** a player opens the join page of a completed pool
- **THEN** they see that it has finished and cannot join it

### Requirement: Joining is offered from Home
The system SHALL show the first-run welcome's join buttons and the Home list of other open pools as links to the pool's join page, so a player always sees the rules before joining.

#### Scenario: From the first-run welcome
- **WHEN** a player in no pool taps a pool on the welcome
- **THEN** they reach that pool's join page

### Requirement: Eliminated players are offered Pick 'Em
The system SHALL offer a player whose survivor entry is out, on Home and on their season view, an open Pick 'Em pool they have not joined, as "Still want in on the action?" with a link to its join page; it SHALL offer nothing when no such pool exists.

#### Scenario: Pick 'Em is open
- **WHEN** an eliminated survivor player opens Home and Pick 'Em is open and not joined
- **THEN** they see the offer and its link

#### Scenario: No Pick 'Em
- **WHEN** no open Pick 'Em pool exists
- **THEN** no offer is shown
