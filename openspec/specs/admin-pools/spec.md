# admin-pools Specification

## Purpose
How the brewery staff manage pools on a phone: see every pool, manage its players (including fixing a mistake), see who has picked, change its settings, lock or delete it, and open a new one in four steps.

## Requirements

### Requirement: Pools list
The system SHALL show on the Pools tab every pool with its name, kind (Survivor or Pick 'em), season, number of players and status (Unlocked while the rules can still change, Locked, Finished), opening that pool when tapped, and a "New pool" button.

#### Scenario: Reading the list
- **WHEN** an admin opens Pools
- **THEN** each pool shows, for example, "Sunday Survivor", "Survivor · 2026 · 64 players" and "Locked"

### Requirement: Pool screen with sub-tabs
The system SHALL show for a pool its name and kind and season, with sub-tabs Players and Settings, and Picks as well for a Survivor pool. A Pick 'em pool SHALL have no Picks tab.

#### Scenario: Survivor pool
- **WHEN** an admin opens a Survivor pool
- **THEN** the tabs are Players, Picks and Settings

#### Scenario: Pick 'em pool
- **WHEN** an admin opens a Pick 'em pool
- **THEN** the tabs are Players and Settings

### Requirement: Players roster
The system SHALL list a pool's players with an avatar, name, email and a status ("Alive", or "Out wk N" for an eliminated player, or the points for Pick 'em), with a count summary ("64 players, 38 alive"), a "Find a player" search over everyone in the pool, a short list with "Show all N", and a mark "Invited" for a player who has no account yet. An admin's own entry SHALL be marked "You".

#### Scenario: Search
- **WHEN** the admin types part of a name
- **THEN** the matching players are shown from the whole pool, not only the short list

#### Scenario: Invited player
- **WHEN** a player was added by email and has not signed in yet
- **THEN** their row says Invited

### Requirement: Fix a player's status
The system SHALL let an admin tap a player and set them Alive or Out, with the week they went out, saving it straight away. Setting Out SHALL require a week; setting Alive SHALL clear the week. The server SHALL refuse an unknown status, an elimination week that is not a whole number from 1 to 25, and Out without a week.

#### Scenario: Restoring a player
- **WHEN** an admin sets an eliminated player to Alive
- **THEN** the player is alive in the standings and Activity records the change

#### Scenario: Eliminating a player
- **WHEN** an admin sets a player to Out in week 3
- **THEN** the roster shows "Out wk 3"

#### Scenario: Invalid edit
- **WHEN** a request sets Out without a week, or week 99
- **THEN** it is refused and nothing changes

#### Scenario: Editing your own entry
- **WHEN** an admin edits their own entry
- **THEN** the editor says the change is recorded in Activity and marked as their own entry, and the record is flagged

### Requirement: Add a player
The system SHALL let an admin add a player by email. If the email belongs to an existing account that player is added; if not, the form SHALL ask for the person's name before adding them, and they join the pool the first time they sign in with that email. Adding someone already in the pool SHALL change nothing.

#### Scenario: Existing account
- **WHEN** an admin adds an email that has an account
- **THEN** that player appears in the roster at once

#### Scenario: New person
- **WHEN** an admin adds an email with no account
- **THEN** the form asks for a name, then the person appears marked Invited

#### Scenario: Already in the pool
- **WHEN** an admin adds someone already in the pool
- **THEN** no second entry is created

### Requirement: Waiting wipeout is flagged on the pool
The system SHALL show on a pool's Players tab a banner linking to the decision screen when a wipeout decision is waiting for that pool.

#### Scenario: Decision waiting
- **WHEN** a wipeout is waiting in the pool
- **THEN** the banner says so and links to the decision

### Requirement: Picks for a Survivor pool, one week at a time
The system SHALL show a Survivor pool's picks for one week at a time with a way to choose the week (the current week by default), the week's pick count ("38 alive · 31 picked"), and filter chips. Before the week locks it SHALL show who has picked and who has not, with the team hidden for every player except the admin's own entry, and SHALL say so ("Teams are hidden until the week locks. That goes for everyone, admins too."). After the lock it SHALL show every player's team with Won, Lost or Waiting.

#### Scenario: Before the lock
- **WHEN** the admin opens a week that has not locked
- **THEN** other players show "Picked" or "Hasn't picked yet" with no team, and the admin's own row shows their team

#### Scenario: After the lock
- **WHEN** the admin opens a locked week
- **THEN** every player's team shows with Won, Lost or Waiting

#### Scenario: Filters
- **WHEN** the admin taps "No pick"
- **THEN** only alive players without a pick are shown

### Requirement: Settings and the rules lock
The system SHALL show a pool's name, season and rules (tie handling, same team twice, extra lives, double-pick weeks) as read-only with the banner "Rules are locked" while the pool is locked, with a button to Unlock the rules, and editable while unlocked, with a button to Lock the rules. The pool total form SHALL work in both states. The server SHALL refuse a change to the name, season or rules of a locked pool, unless the same request unlocks it, and SHALL still accept the pool total and the lock and unlock.

#### Scenario: Locked pool
- **WHEN** an admin opens the settings of a locked pool
- **THEN** the fields are read-only, "Unlock the rules" is offered, and the pool total can still be saved

#### Scenario: Server refuses
- **WHEN** a request changes a locked pool's name
- **THEN** it is refused with a message that the rules are locked and the name is unchanged

#### Scenario: Unlocking and editing together
- **WHEN** one request unlocks the pool and changes a rule
- **THEN** both are applied

#### Scenario: Unlocked pool
- **WHEN** a pool is unlocked
- **THEN** the rules can be changed and "Lock the rules" is offered

### Requirement: Delete a pool safely
The system SHALL offer "Delete pool" in settings, explaining that it permanently deletes the pool, its players and all their picks and cannot be undone, and SHALL require the pool's name to be typed before deleting; afterwards it SHALL return to the Pools list.

#### Scenario: Wrong name
- **WHEN** the typed name does not match
- **THEN** the delete button stays unavailable and nothing is deleted

#### Scenario: Confirmed
- **WHEN** the exact name is typed and confirmed
- **THEN** the pool is deleted and Activity records it

### Requirement: New pool in four steps
The system SHALL offer a four-step screen with no tab bar: name the pool; choose Survivor or Pick 'em (with "You can't change this later"); check the rules in plain words (with "Change a rule" and "These look right"); and a final review of name, kind and season with "Open the pool". Opening SHALL create the pool and lock its rules, then say "<name> is open. Players can join now." with the link to share and "Back to your steps". "Change a rule" SHALL create the pool unlocked and open its settings.

#### Scenario: Opening a pool
- **WHEN** the admin completes the four steps and taps "Open the pool"
- **THEN** the pool exists, is locked, and players can join it

#### Scenario: Changing a rule first
- **WHEN** the admin taps "Change a rule"
- **THEN** the pool is created unlocked and its settings open

#### Scenario: Season default
- **WHEN** the review step is shown
- **THEN** the season is the latest one with games, which the admin can change

### Requirement: Admin pool screens fit a phone
The system SHALL fit every screen in this change in 390 pixels without sideways scrolling, with every button at least 44 pixels tall.

#### Scenario: Narrow screen
- **WHEN** any of these screens is opened at 390 pixels wide
- **THEN** nothing scrolls sideways and the buttons are at least 44 pixels tall

### Requirement: Settings has the reveal rule
The pool Settings screen SHALL offer "When other players' picks show" with the choices "When the week locks" and "After the week's last game is final", with a line explaining the second choice. It SHALL be saved and locked with the other rules, and refused by the server on a locked pool like any other rule change.

#### Scenario: Choosing the later reveal
- **WHEN** an admin picks "After the week's last game is final" on an unlocked pool and saves
- **THEN** the pool's rules carry `reveal_picks: after_final_game`

#### Scenario: Locked pool
- **WHEN** the pool's rules are locked
- **THEN** the choice cannot be changed until the rules are unlocked
