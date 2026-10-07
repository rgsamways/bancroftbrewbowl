# admin-activity Specification

## Purpose
A permanent, admin-only record of every change an admin makes to standings or content: who made it, what it was, which pool it concerned, when, and whether it touched their own entry.

## Requirements

### Requirement: Admin changes are recorded
The system SHALL write one activity record, naming the signed-in admin, each time an admin successfully: enters or changes a game result, changes a game's score, resolves a wipeout, changes a player's status, adds a player to a pool, creates a pool, locks or unlocks a pool, edits a pool's settings, changes a pool's total, deletes a pool, creates, edits or deletes an announcement, changes an automatic offer, creates, edits or deletes a TV playlist, changes which playlist a TV screen plays or its QR setting, or (god-user) creates, renames, deletes or resets the link of a TV screen. A record SHALL never contain a screen's private link.

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

#### Scenario: Switching a TV playlist
- **WHEN** an admin sets "Bar TV" to play "Holiday"
- **THEN** a record says that admin set Bar TV to play Holiday, and no link appears in it

### Requirement: Each record says who, what, where and when
The system SHALL store with each record the admin's id and their name at that time, the kind of change, a plain-English sentence, the pool when there is one, whether it affected the admin's own entry, and the time. The sentence SHALL stay as written even if names or pools change or are deleted later.

#### Scenario: Pool deleted later
- **WHEN** a pool is deleted after changes to it were recorded
- **THEN** those records remain, with their sentences, and no longer link to a pool

#### Scenario: Admin account removed later
- **WHEN** an admin's account is deleted
- **THEN** their records remain with the name they had

### Requirement: Changes to the admin's own entry are flagged
The system SHALL mark a record "affects the admin's own entry" when the change altered the standing of an entry the acting admin owns: editing their own status, adding themselves to a pool, resolving a wipeout that eliminated or kept their entry, deleting a pool they play in, or entering a result that eliminated their entry.

#### Scenario: Editing own status
- **WHEN** an admin sets their own entry to alive
- **THEN** the record is flagged as affecting their own entry

#### Scenario: Result that eliminates the admin
- **WHEN** an admin enters a result that eliminates their own entry in a pool
- **THEN** the record is flagged

#### Scenario: Someone else's entry
- **WHEN** an admin changes another player's status
- **THEN** the record is not flagged

### Requirement: Only admins can read the record
The system SHALL provide the record to admins only, newest first, 50 at a time, with a way to load earlier entries, and SHALL refuse players and signed-out visitors.

#### Scenario: Player asks
- **WHEN** a player who is not an admin requests the record
- **THEN** the request is refused as forbidden

#### Scenario: Signed out
- **WHEN** the record is requested without a session
- **THEN** it is refused as not signed in

#### Scenario: Paging
- **WHEN** there are more than 50 records
- **THEN** the first request returns the newest 50 and a way to ask for the 50 before them

### Requirement: The record can be filtered
The system SHALL let an admin show Everything, only Standings changes, only changes marked as affecting their own entry, or only Menu changes.

#### Scenario: Standings only
- **WHEN** the Standings filter is chosen
- **THEN** results, status changes, wipeout decisions, players and pool changes are shown and announcements are not

#### Scenario: Your own entry
- **WHEN** the Your own entry filter is chosen
- **THEN** only records flagged as affecting the viewing admin's own entry are shown

#### Scenario: Menu filter before a menu exists
- **WHEN** the Menu filter is chosen and no menu changes have been recorded
- **THEN** the list is empty with a plain message

### Requirement: The record cannot be changed
The system SHALL provide no way to edit or delete an activity record through the app, including for admins.

#### Scenario: Attempt to edit or delete
- **WHEN** an admin tries to change or delete a record through the service
- **THEN** the request is not found and the record is unchanged

### Requirement: The Activity page
The system SHALL show admins an Activity page reached from the admin screens, titled "Activity", with "Every change that affects the standings or the menu, and who made it.", each entry showing a day and time in Eastern time ("Today · 5:04 PM", "Yesterday · 6:40 PM", "Mon · 9:15 AM"), a short title, the sentence, and a mark "Your own entry" or "Affects <name>'s entry" where flagged, the filters, a button to load earlier entries, and the note "Nothing here can be edited or deleted. Players don't see this page." Players SHALL have no link to it, and opening its address SHALL show nothing of the record.

#### Scenario: Reading
- **WHEN** an admin opens Activity after entering a result
- **THEN** the newest entry shows "Today", the time, "Entered a result" and the sentence naming the game

#### Scenario: Player opens the address
- **WHEN** a player who is not an admin opens the Activity address
- **THEN** they are sent away and no records are shown

### Requirement: Every admin write is covered
The system SHALL not leave an admin write route without a record: adding a new admin write route without recording it SHALL fail the test suite.

#### Scenario: Coverage check
- **WHEN** the tests run
- **THEN** every route that requires an admin and changes data is shown to write a record, or to be listed as deliberately not recorded with a reason
