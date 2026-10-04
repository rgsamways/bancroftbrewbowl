# admin-steps Specification

## Purpose
The phone-first screens an admin uses for the weekly job: a card that says what to do next, results entered one game at a time or from a list, a safe way to correct a result, and a clear decision screen when a result would knock out every remaining player.

## Requirements

### Requirement: Admin screens have their own tab bar
The system SHALL show on admin screens a bottom tab bar with Next step, Results, Pools and More, in that order, marking the current one, instead of the player tab bar. The screens that walk through a task (results one game at a time, the wipeout decision) SHALL show no tab bar, only a Back control, a "Step N of M" label where there are steps, and a Leave control. The bar SHALL fit a 390 pixel wide screen with tap targets of at least 44 pixels. There SHALL be no Menu tab until a menu exists.

#### Scenario: An admin opens the admin area
- **WHEN** an admin opens Admin from the player tab bar
- **THEN** they see Next step, Results, Pools and More, with Next step marked

#### Scenario: A task screen
- **WHEN** an admin starts entering results one at a time
- **THEN** the tab bar is gone and Back, "Step 1 of N" and Leave are shown

#### Scenario: A player
- **WHEN** a person who is not an admin opens an admin address
- **THEN** they are sent away and no admin information is shown

### Requirement: Next step says what to do now
The system SHALL provide `GET /admin/summary` for admins only (401 signed out, 403 for players), returning the server's time, the current season and week, the number of games in that week and how many have results, the games that have kicked off with no result, any wipeout decisions waiting (with the pool, week and game), each pool's status and alive and total counts, whether a schedule is loaded, and the single next step. The next step SHALL be, in this order: deciding a waiting wipeout; entering results for games that have kicked off with no result; otherwise "all caught up". The Next step screen SHALL show that one step as a card with a Start button.

#### Scenario: A wipeout is waiting
- **WHEN** a wipeout decision is waiting and results are also waiting
- **THEN** the card is "Needs your attention" for the wipeout

#### Scenario: Results waiting
- **WHEN** two games have kicked off with no result and nothing else needs a decision
- **THEN** the card says to enter the 2 results still waiting, names the games, and its button starts the one-at-a-time screen

#### Scenario: A game that has not kicked off
- **WHEN** a game is still to be played
- **THEN** it does not count as waiting for a result

#### Scenario: All caught up
- **WHEN** nothing needs doing
- **THEN** the card says "All done for now" and "Nothing needs you."

#### Scenario: No schedule
- **WHEN** no games are loaded for any season
- **THEN** the screen says there is no schedule yet and that it is loaded once a season by the developer

#### Scenario: Current week
- **WHEN** a season has some weeks fully decided and some not
- **THEN** the current week is the first week of the latest season that is not fully decided

### Requirement: Your week checklist
The system SHALL show under the card, when a schedule is loaded, a checklist: schedule loaded (games in the week), picks locked (and when) or open, results entered ("13 of 16"), and each pool with its alive and total players.

#### Scenario: Mid-week
- **WHEN** 13 of 16 games have results
- **THEN** the checklist shows "13 of 16 entered" linking to Results

### Requirement: Results list for the current week
The system SHALL show on the Results screen the games of the current week grouped as "Waiting for a result", "Not played yet" and "Done", with the week and season, "N of M entered", and a link to enter them one at a time. A game that has kicked off with no result SHALL show buttons for each team winning and for a tie. A game not yet played SHALL show when it kicks off and no result buttons. A done game SHALL show who won and a Change control. Arrows SHALL let the admin move to the previous or next week to correct an earlier result.

#### Scenario: Entering from the list
- **WHEN** an admin taps "Bears won" on a game that has kicked off
- **THEN** the result is saved, the standings are scored, and the game moves to Done

#### Scenario: Future game
- **WHEN** a game has not kicked off
- **THEN** it shows "Kicks off" with its time and no way to enter a result

#### Scenario: Earlier week
- **WHEN** the admin taps the previous-week arrow
- **THEN** that week's games are shown with their results and Change controls

### Requirement: Correcting a result is deliberate and honest
The system SHALL, when an admin taps Change on a done result, show "Change this result?" naming the game and the result entered, buttons for either team winning, a tie, and "Keep it as it is". For a season that has a survivor pool it SHALL warn that players this result already knocked out are not brought back automatically and must be fixed on the roster, and that pick 'em points update by themselves. Saving SHALL use the same scoring as entering a result and SHALL be recorded in Activity as a change.

#### Scenario: Keep it
- **WHEN** the admin taps "Keep it as it is"
- **THEN** nothing changes and no record is written

#### Scenario: Change it
- **WHEN** the admin chooses the other team
- **THEN** the result is replaced, scoring runs, and Activity records a changed result

#### Scenario: Survivor warning
- **WHEN** the season has a survivor pool
- **THEN** the warning about players already knocked out is shown

#### Scenario: No survivor pool
- **WHEN** the season has only pick 'em pools
- **THEN** only the note that points update by themselves is shown

### Requirement: Results one game at a time
The system SHALL offer a screen that walks through the games waiting for a result, showing "Who won?", "Game N of M waiting for a result", the matchup and kickoff, a button for each team winning, "It was a tie" and "Skip this one for now", with the note that the answer counts in every pool this season. Each answer SHALL save immediately and move to the next game. A skipped game SHALL stay waiting.

#### Scenario: Two games
- **WHEN** two games are waiting
- **THEN** the screen shows "Step 1 of 2", saves the answer, then shows "Step 2 of 2"

#### Scenario: Skip
- **WHEN** the admin skips a game
- **THEN** it is left without a result and the walk continues

#### Scenario: Leaving part way
- **WHEN** the admin taps Leave after one answer
- **THEN** that answer stays saved and the Results list shows the rest still waiting

### Requirement: The done screen tells the truth
The system SHALL finish the walk with a screen that says how many results are in and, if any answer led to a wipeout decision, says so and sends the admin to decide it instead of saying nothing needs a decision. If answers were skipped it SHALL say how many are still waiting.

#### Scenario: Clean finish
- **WHEN** every answer is saved and no pool needs a decision
- **THEN** the screen says the results are in and no pool needs a decision

#### Scenario: A wipeout happened
- **WHEN** one answer would knock out every remaining player in a pool
- **THEN** the done screen says a pool needs a decision and links to the wipeout screen

### Requirement: Wipeout decision
The system SHALL show for a waiting wipeout the pool, week and game, that nothing has been applied yet, each candidate with what they picked, a way to tick who stays in with everyone unticked eliminated, a live "N of M will stay in. The other K are eliminated in week W." and a button "Keep N players alive". When one candidate is the viewing admin's own entry it SHALL be marked "You" with a note that the decision is recorded in Activity as affecting their own entry. Saving SHALL use the existing resolve action and return the admin to the Next step screen.

#### Scenario: Keeping two of five
- **WHEN** the admin ticks two of five and confirms
- **THEN** those two stay alive, the other three are eliminated in that week, and Activity records the decision

#### Scenario: The admin's own entry
- **WHEN** the admin's own entry is among the five
- **THEN** it shows "You" and the recorded-in-Activity note

#### Scenario: Picks shown
- **WHEN** the wipeout screen lists the candidates
- **THEN** each shows the team they picked, because the week has locked

### Requirement: More
The system SHALL provide a More screen with: Enter results, Activity (who changed what), All pools, the season schedule check, "Switch back to the player view", and Me. The old Promotions page SHALL remain reachable from More until the announcements work replaces it.

#### Scenario: Back to the player view
- **WHEN** the admin taps "Switch back to the player view"
- **THEN** they land on the player Home with the player tab bar

### Requirement: The old Schedule page is gone
The system SHALL no longer offer the old Schedule page; its address SHALL lead to Results.

#### Scenario: Old address
- **WHEN** someone opens the old schedule address
- **THEN** they are taken to Results

### Requirement: Admin screens fit a phone
The system SHALL fit every admin screen in this change in 390 pixels without sideways scrolling, with every button at least 44 pixels tall.

#### Scenario: Narrow screen
- **WHEN** any of these screens is opened at 390 pixels wide
- **THEN** nothing scrolls sideways and the buttons are at least 44 pixels tall
