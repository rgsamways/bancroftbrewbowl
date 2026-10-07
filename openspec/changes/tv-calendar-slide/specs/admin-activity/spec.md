## MODIFIED Requirements

### Requirement: Admin changes are recorded
The system SHALL write one activity record, naming the signed-in admin, each time an admin successfully: enters or changes a game result, changes a game's score, resolves a wipeout, changes a player's status, adds a player to a pool, creates a pool, locks or unlocks a pool, edits a pool's settings, changes a pool's total, deletes a pool, creates, edits or deletes an announcement, changes an automatic offer, creates, edits or deletes a TV playlist, changes which playlist a TV screen plays or its QR setting, (god-user) creates, renames, deletes or resets the link of a TV screen, posts or removes a site notice, or adds, changes, cancels a single day of, or removes a calendar entry. A record SHALL never contain a screen's private link.

#### Scenario: Entering a result
- **WHEN** an admin enters a game result
- **THEN** a record exists naming that admin, saying which game and result, dated now

#### Scenario: Changing an existing result
- **WHEN** an admin changes a result that was already entered
- **THEN** the record says the result was changed, not entered

#### Scenario: Locking a pool
- **WHEN** an admin locks a pool
- **THEN** a record says that admin locked that pool's rules

#### Scenario: Pool total
- **WHEN** an admin changes a pool's total
- **THEN** a record says so, naming the pool and the new total

#### Scenario: A refused change
- **WHEN** a request is refused (not an admin, invalid, not found)
- **THEN** no record is written

#### Scenario: Cancelling one day
- **WHEN** an admin cancels one Tuesday of "Trivia"
- **THEN** a record says that admin cancelled Trivia on that date
