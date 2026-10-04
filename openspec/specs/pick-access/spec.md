# pick-access Specification

## Purpose

Keeps the pool fair and players' details private: only the owner of an entry can change its picks, nobody sees anyone else's pick before the week locks, and email addresses are visible only to admins and to the person they belong to.

## Requirements

### Requirement: Only the owner can change a pick
The system SHALL allow a pick on an entry to be submitted, changed or deleted only by the signed-in person who owns that entry. This SHALL apply equally to admins: an admin SHALL NOT be able to change another player's picks.

#### Scenario: Owner submits a pick
- **WHEN** a signed-in player submits a pick on their own entry before the week locks
- **THEN** the pick is saved

#### Scenario: Someone else's entry
- **WHEN** a signed-in player submits, changes or deletes a pick on an entry that belongs to a different person
- **THEN** the request is refused with the message "You can only change your own picks." and nothing changes

#### Scenario: An admin tries to change a player's pick
- **WHEN** an admin submits, changes or deletes a pick on an entry that belongs to a different person
- **THEN** the request is refused in the same way and nothing changes

#### Scenario: Entry not yet claimed
- **WHEN** a pick is submitted on an entry that an admin added by email and that nobody has signed in to claim yet
- **THEN** the request is refused, because no signed-in person owns it

#### Scenario: Not signed in
- **WHEN** a request to change a pick arrives with no valid session
- **THEN** it is refused as not signed in and nothing changes

### Requirement: Picks are private until the week locks
The system SHALL show a signed-in person only their own picks for a week until that week locks. A week locks at its first kickoff. After it locks, the picks for that week SHALL be readable by every signed-in person.

#### Scenario: Reading someone else's pick before the lock
- **WHEN** a signed-in player asks for another player's picks, or a pool's picks, for a week that has not locked
- **THEN** the response contains none of the other players' picks for that week, and does not show whether they have picked

#### Scenario: Reading picks after the lock
- **WHEN** the week's first kickoff has passed and a signed-in player asks for a pool's picks
- **THEN** the response includes every player's picks for that week

#### Scenario: Own picks are always visible
- **WHEN** a signed-in person asks for their own picks for any week
- **THEN** they see all of them, locked or not

#### Scenario: Mixed weeks
- **WHEN** a pool has some locked weeks and one unlocked week
- **THEN** the response shows everyone's picks for the locked weeks and only the caller's own picks for the unlocked week

### Requirement: Admins can see who has picked, but not what, before the lock
The system SHALL let an admin see which other players have a pick in for an unlocked week, without revealing the team chosen or its result. After the week locks, admins SHALL see everything that other players can see.

#### Scenario: Admin reads an unlocked week
- **WHEN** an admin asks for a pool's picks for a week that has not locked
- **THEN** each other player who has picked appears with a marker that they have picked, and no team or result is included

#### Scenario: A player gets no such marker
- **WHEN** an ordinary player asks for the same data
- **THEN** other players' entries do not appear at all for that week

#### Scenario: An admin who also plays
- **WHEN** an admin owns an entry in the pool
- **THEN** they see their own picks in full, and only the marker for everyone else, until the week locks

### Requirement: Email addresses are private
The system SHALL include a player's email address in a pool's player list only for admins and for that player's own entry. Every other signed-in person SHALL see the player's name, status and points but no email.

#### Scenario: A player reads the player list
- **WHEN** an ordinary signed-in player asks for a pool's player list
- **THEN** no entry in the response includes an email address, other than possibly their own

#### Scenario: An admin reads the player list
- **WHEN** an admin asks for the same list
- **THEN** each entry includes the player's email address

#### Scenario: Standings still work
- **WHEN** the standings page loads the player list as an ordinary player
- **THEN** names, status, elimination week and points are all present

### Requirement: The screens do not offer what the server refuses
The system SHALL NOT present controls that lead to a refused action, and SHALL explain a refusal in plain English.

#### Scenario: Standings names
- **WHEN** a player views the standings
- **THEN** other players' names are not links to their pick screens

#### Scenario: Opening someone else's pick screen by address
- **WHEN** a player opens the pick screen address for an entry that isn't theirs
- **THEN** they see "That isn't your entry." with a way back to their own pools, and no controls to change anything

#### Scenario: Admin picks table before the lock
- **WHEN** an admin views the picks table for an unlocked week
- **THEN** players who have picked show "Picked" with no team name, and players who haven't show "No pick"

### Requirement: Locking, scoring and eliminations are unchanged
The system SHALL keep the existing rules for when a week locks, which picks are valid, and how results score picks and eliminate players.

#### Scenario: Deadline still enforced
- **WHEN** the owner of an entry submits or deletes a pick after the week's first kickoff
- **THEN** the request is refused with the existing "Pick deadline has passed" message

### Requirement: A pool chooses when other players' picks become visible
Each pool SHALL have a rule `reveal_picks` with the values `at_lock` (the default, and the behaviour of a pool that has no such rule) and `after_final_game`. With `at_lock`, other players' picks for a week become visible when the week locks. With `after_final_game`, they become visible only once every game of that week has a result. A player's own picks SHALL always be visible to them. Before the reveal an admin SHALL see only that a player has picked, never the team or result. The rule applies to both pool types and to every route that returns picks.

#### Scenario: Default
- **WHEN** a pool has no `reveal_picks` rule and the week has locked
- **THEN** other players' picks for that week are visible

#### Scenario: Held until the last game is final
- **WHEN** a pool uses `after_final_game`, the week has locked and one game still has no result
- **THEN** a player sees none of the other players' picks for that week, and an admin sees only "picked"

#### Scenario: Revealed after the last game
- **WHEN** every game of that week has a result
- **THEN** all picks for that week are visible to every signed-in player

#### Scenario: Own picks
- **WHEN** a pool uses `after_final_game` and the week has not been revealed
- **THEN** a player still sees their own picks in full
