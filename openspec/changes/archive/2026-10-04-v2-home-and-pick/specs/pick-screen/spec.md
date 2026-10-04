## Purpose

How a player makes, changes and reviews picks on a phone: the week's games as a list, clear used-team and locked states, a deliberate confirm step for survivor, tap-to-pick for pick 'em, and the server rule that a pick must be for a team playing that week.

## ADDED Requirements

### Requirement: The pick screen lists the week's games by day
The system SHALL show, for the entry's current open week, the games grouped under day headings with kickoff times in Eastern time, each game as two team cards (city and nickname), under a title "Week N pick" (survivor) or "Week N picks" (pick 'em), the pool line, and a lock countdown from the server's clock.

#### Scenario: Games grouped
- **WHEN** the week has Sunday and Monday games
- **THEN** they appear under "Sunday" and "Monday" headings, each with its kickoff time

### Requirement: Survivor picks are confirmed
The system SHALL let a survivor player tap a team to select it, show a bar at the bottom naming the team, its game and "You can change this until kickoff.", and save the pick only when the player taps "Lock in <team>". After saving, the screen SHALL say "Locked in", name the pick and offer "Change my pick" and "Back to Home".

#### Scenario: Select then lock in
- **WHEN** a player taps the Chiefs and then "Lock in Chiefs"
- **THEN** the pick is saved and the screen shows "Locked in. You picked the Chiefs."

#### Scenario: Selected but not locked in
- **WHEN** a player taps a team and leaves without tapping the button
- **THEN** no pick has been saved

#### Scenario: Changing a pick
- **WHEN** a player with a saved pick taps "Change my pick", selects another team and locks it in before the lock
- **THEN** the new team replaces the old pick

### Requirement: Teams already used are dimmed
The system SHALL dim a team the entry has used in another week, label it "Used week N", and not let it be selected, unless the pool allows repeat teams.

#### Scenario: Used team
- **WHEN** the entry picked Dallas in week 2 and opens week 5
- **THEN** Dallas shows "Used week 2", is dimmed and cannot be selected

### Requirement: Double-pick weeks take two teams
The system SHALL, in a double-pick week, say "Pick two teams to win" with a banner that if either loses or ties the player is out, show the chosen teams as chips and the slot for the next, show "1 of 2 picked" until two are chosen, and enable "Lock in 2 picks" only when two teams are selected.

#### Scenario: One of two
- **WHEN** one team is selected in a double-pick week
- **THEN** the bar shows "1 of 2 picked. Pick one more team to lock in this week." and the button is disabled

#### Scenario: Save failure part way
- **WHEN** the second of two picks fails to save
- **THEN** the screen reloads what is saved, says which pick did not save, and lets the player try again

### Requirement: Pick 'em picks save as you tap
The system SHALL save a pick 'em pick the moment a team is tapped, mark it "Picked", show "N of M picked", show "N games left to pick" with a "Jump to next" link that scrolls to the next unpicked game, and say "All picks in" when every game is picked. Changing a pick SHALL replace the earlier one for that game.

#### Scenario: Tap to pick
- **WHEN** a player taps a team in an unpicked game
- **THEN** it shows "Picked" and the count goes up by one

#### Scenario: Jump to next
- **WHEN** a player taps "Jump to next"
- **THEN** the next unpicked game scrolls into view

#### Scenario: Picks fail to save
- **WHEN** a tap cannot be saved
- **THEN** the team is not shown as picked and a message says the pick was not saved

### Requirement: Locked weeks show the pick, not buttons
The system SHALL, once the week has locked, show "Picks are locked", the player's pick or picks, and each game's state: survivor games "Waiting" or the result; pick 'em games "Waiting for result", "Final" with "Correct" or "Wrong", or "No pick made". No team SHALL be selectable and the note "Picks can't be changed once the week's first game has started." SHALL be shown.

#### Scenario: After the first kickoff
- **WHEN** a player opens the pick screen after the week's first kickoff
- **THEN** they see their pick and no way to change it

### Requirement: Eliminated players see their season
The system SHALL show an eliminated survivor entry "Eliminated in week N", "You're out of this one. Picks are done for you, but you can keep following along.", the list of their picks with each result, and buttons "See standings" and, when an open Pick 'Em pool exists that they are not in, "Join <pool>".

#### Scenario: Eliminated entry opens Pick
- **WHEN** an eliminated entry's pick screen is opened
- **THEN** the pick history is shown with "Correct" or "Wrong" per week and no team can be selected

### Requirement: Someone else's entry is refused
The system SHALL show "That isn't your entry", "You can only make picks for your own entry.", and a "Back to my pools" button, with no pick controls and no information about the entry's picks, to anyone opening another player's pick screen, admins included.

#### Scenario: Another player's address
- **WHEN** a signed-in player opens another player's pick screen
- **THEN** they see "That isn't your entry" and the data request is refused

### Requirement: One request supplies the pick screen
The system SHALL provide `GET /entries/:entryId/pick-sheet`, owner only (404 for no entry, 403 for another player, 401 signed out), returning the server's time, the week and its lock time, the week's games with kickoff and result, the entry's picks, the teams used and the weeks they were used, how many picks the week takes, and the screen state.

#### Scenario: Owner
- **WHEN** the entry's owner requests the sheet
- **THEN** they receive their week's games, picks and used teams

#### Scenario: Not the owner
- **WHEN** a different signed-in player, including an admin, requests it
- **THEN** it is refused with 403 and contains no picks

### Requirement: A pick must be for a team playing that week
The system SHALL refuse, with a plain message, a pick for a team that has no game in the chosen week, and SHALL leave the entry's picks unchanged.

#### Scenario: Team on a bye
- **WHEN** a request picks a team with no game in that week
- **THEN** it is refused as not playing that week and no pick is saved

#### Scenario: Normal pick
- **WHEN** a request picks a team that plays that week
- **THEN** it is accepted as before

### Requirement: The Pick tab goes where the player needs to be
The system SHALL, on the Pick tab, take a player to the pick screen of the entry that needs attention (the same choice as Home), and show "You haven't joined a pool yet" with "Go to Home" to a player in no pool. A player whose entries are all out SHALL be taken to their most recent entry's "Your season" view.

#### Scenario: One pool needing a pick
- **WHEN** a player with one alive entry taps the Pick tab
- **THEN** they land on that entry's pick screen

#### Scenario: In no pool
- **WHEN** a player in no pool taps the Pick tab
- **THEN** they see "You haven't joined a pool yet" and a link to Home
