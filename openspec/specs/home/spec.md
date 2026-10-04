# home Specification

## Purpose
What a signed-in player sees on Home: one hero card for the entry that needs attention, a way to switch between their pools, a countdown to the pick lock, and the single summary request that supplies it all.

## Requirements

### Requirement: Home shows one hero for the entry that needs attention
The system SHALL show on Home a hero card for one of the player's entries, chosen in this order: entries that are alive and have picks still to make, soonest lock first; then alive entries that are fully picked; then entries whose week has locked; then eliminated entries; then entries whose season is over. The hero SHALL name the pool and show its status line and one main button.

#### Scenario: Two pools, one needs a pick
- **WHEN** a player is alive in two pools and has picked in one but not the other
- **THEN** Home opens on the pool that still needs a pick

#### Scenario: Ties on need
- **WHEN** two alive entries both need picks
- **THEN** the one whose week locks first is shown first

### Requirement: Home has a pool switcher when there are several pools
The system SHALL show, when the player has more than one entry, a row of chips under the header, one per pool, with the shown pool selected. Tapping a chip SHALL show that pool's hero without reloading the page. With one entry there SHALL be no chips.

#### Scenario: Switching
- **WHEN** a player in two pools taps the other pool's chip
- **THEN** the hero changes to that pool's state, buttons and countdown

#### Scenario: One pool
- **WHEN** a player is in exactly one pool
- **THEN** no switcher is shown

### Requirement: Survivor hero states
The system SHALL show these states for a survivor entry, each with the stated headline and button, and the pool line "<pool> · N of M players left" (or "<pool> · M players" before any elimination):
- Not picked: "You're still alive", "Week N: make your pick", a lock countdown, "Make my pick".
- Picked: "Locked in", "Week N: you're all set", a lock countdown, "Change my pick".
- Locked: "Picks are locked", "Games are underway", no countdown, "See standings".
- Out: "You're out", "Thanks for playing", "<pool> · you went out in week N", "See standings".
- Season over: "<year> season complete", "That's a wrap", "Thanks for playing. See you next season.", "See final standings", and the champion's name when there is one.

#### Scenario: Not picked
- **WHEN** an alive survivor entry has no pick for the current open week
- **THEN** Home shows "You're still alive", "Week N: make your pick", the countdown and "Make my pick"

#### Scenario: Double-pick week half done
- **WHEN** it is a double-pick week and the entry has made one of two picks
- **THEN** Home still counts it as not picked and the button reads "Make my pick"

#### Scenario: Picked
- **WHEN** the entry has all its picks for the week and the week has not locked
- **THEN** Home shows "Locked in", the countdown and "Change my pick"

#### Scenario: Out
- **WHEN** the entry is eliminated
- **THEN** Home shows "You're out" and the week it went out, and nothing about lives or mulligans

### Requirement: Pick 'em hero states
The system SHALL show these states for a pick 'em entry, with "Your points N", "Rank T4 of 41" style rank and "N of M picked":
- Picks to make: headline "Tied for 4th of 41" (or "4th of 41"), "Week N: make your picks", countdown, "Finish my picks" (or "Make my picks" when none made).
- All picked: "All picks in", "Week N: you're all set", points and rank, countdown, "Review or change my picks".
- Locked: "Picks are locked", "Games are underway", points, "This week: N correct so far", "See my picks".
- Season over: as for survivor, with the winner by points.

#### Scenario: Partly picked
- **WHEN** a pick 'em entry has picked 9 of 14 games
- **THEN** Home shows "9 of 14 picked" and "Finish my picks"

#### Scenario: Shared rank
- **WHEN** four players are tied for 4th place
- **THEN** each shows "T4" and the next player below them is ranked 8th

### Requirement: The lock countdown uses the server's clock
The system SHALL show the time left to the week's lock as days, hours and minutes (for example "Locks in 2d 14h 37m", "Locks in 3h 5m", "Locks in 12m", "Locks in less than a minute"), calculated from the server's time sent with the summary, not the phone's clock. When the countdown reaches zero the screen SHALL switch to the locked state and reload the summary.

#### Scenario: Phone clock is wrong
- **WHEN** the phone's clock is an hour fast
- **THEN** the countdown still matches the server's lock time

#### Scenario: Reaching the lock
- **WHEN** the countdown reaches zero while Home is open
- **THEN** Home shows the locked state without a manual refresh

### Requirement: Home with no pools
The system SHALL show "No pools open yet" with "Nothing to join right now. Check back soon, new pools show up here as soon as the brewery opens them." to a player in no pool when no pool is open to join. A player in no pool when pools are open SHALL see the first-run welcome with those pools.

#### Scenario: Nothing to join
- **WHEN** a player in no pool opens Home and no pool is open
- **THEN** they see "No pools open yet"

### Requirement: Pools the player can join are offered
The system SHALL list under the hero, for a player who is in at least one pool, each open pool they are not in, linking to that pool's join page.

#### Scenario: Another pool is open
- **WHEN** a player in Sunday Survivor opens Home while Brew Bowl Pick 'Em is open
- **THEN** Home offers Pick 'Em with a link to its join page

### Requirement: One summary request supplies Home
The system SHALL provide `GET /me/summary`, for a signed-in player only, returning the server's current time and, for each of the player's entries: the entry and pool identity and type, season year, status and elimination week, the current week, the lock time, the picks made and picks needed, the screen state, and, for survivor, players left and total players, and, for pick 'em, points, rank, total players, games picked, total games and correct picks this week. It SHALL contain only the caller's own entries and only counts and names that other players can already see.

#### Scenario: Signed out
- **WHEN** the summary is requested without a session
- **THEN** it is refused as not signed in

#### Scenario: Only my entries
- **WHEN** a player requests their summary
- **THEN** it lists their entries and no other player's picks or emails

#### Scenario: Current week
- **WHEN** a season has some weeks completed and some not
- **THEN** the current week is the first week of the latest season that is not completely decided; when every week is decided the entry's state is season over

### Requirement: Lives and retired offers stay off player screens
The system SHALL NOT show lives, mulligans, the retired automatic offers or prize, odds or drink-reward wording on Home or the screens in this change, and SHALL show "Please drink responsibly." on Home.

#### Scenario: Mulligan setting exists
- **WHEN** a pool has mulligans allowed
- **THEN** no player screen mentions it

### Requirement: Home links to the latest recap
`GET /me/summary` SHALL carry, for each entry, `recapWeek`: the latest fully decided week in which the pool had picks, or null. Home SHALL show a "Week N recap" card under the hero of the entry in view when `recapWeek` is set, linking to that pool's recap page, and no card when it is null.

#### Scenario: A decided week
- **WHEN** week 4 is fully decided and picks were made
- **THEN** Home shows a "Week 4 recap" card linking to the recap

#### Scenario: Nothing decided yet
- **WHEN** no week is fully decided
- **THEN** Home shows no recap card

### Requirement: Home asks for a display name when there isn't one
Home SHALL show a "What should we call you?" card whenever the signed-in account's name is empty or contains an "@". Saving a name SHALL set the account's display name (the same one as on the Me page) and the card SHALL then disappear. The card SHALL NOT block joining a pool or picking. Champion names on Home SHALL follow the same safe-name rule as Standings.

#### Scenario: No real name yet
- **WHEN** a player whose account name is their email opens Home
- **THEN** the card is shown, and after saving "Lark P." it is gone and Standings shows "Lark P."

#### Scenario: Already named
- **WHEN** a player's name is "Robin S."
- **THEN** no card is shown
