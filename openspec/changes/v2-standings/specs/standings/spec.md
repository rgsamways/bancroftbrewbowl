## Purpose

How a player sees where they and everyone else stand in a pool: a summary of their own position, the pool total, a way to find another player, and short lists that expand, for survivor and pick 'em pools.

## ADDED Requirements

### Requirement: One request supplies Standings
The system SHALL provide `GET /pools/:poolId/standings`, for a signed-in player only (401 signed out, 404 for no such pool), returning the pool's name, kind, season and status, its pool total, the number of the last fully decided week, the total number of players, which entry is the caller's (if any), and the lists described below. It SHALL contain player names, status, elimination weeks and points only, and SHALL NOT contain any email address or any pick.

#### Scenario: Signed out
- **WHEN** standings are requested without a session
- **THEN** the request is refused as not signed in

#### Scenario: No emails or picks
- **WHEN** a player requests standings for a pool
- **THEN** the answer contains no email address and no team picks

#### Scenario: Unknown pool
- **WHEN** a signed-in player requests standings for a pool that does not exist
- **THEN** the answer is "not found"

### Requirement: Survivor summary
The system SHALL show, for a survivor pool, a summary card with a headline for the viewer ("You're still alive" for an alive entry, "You're out" for an eliminated one, the pool name for someone with no entry), "N of M still alive", and "After week W · P players out so far" (or "Before week 1" when no week is decided), with the pool total card below it when the pool has a total.

#### Scenario: Alive player
- **WHEN** an alive player opens Standings for a pool with 64 players of whom 38 are alive after week 4
- **THEN** the card says "You're still alive", "38 of 64 still alive" and "After week 4 · 26 players out so far"

#### Scenario: Eliminated player
- **WHEN** an eliminated player opens Standings
- **THEN** the headline is "You're out" and the counts are the same

#### Scenario: No total
- **WHEN** the pool has no total
- **THEN** no pool total card is shown

### Requirement: Survivor lists
The system SHALL list under "Still alive" each alive player, the viewer first (marked "You") and the rest in alphabetical order, and under "Eliminated" each eliminated player, most recently eliminated first, with "Out in week N". Each list SHALL show at most 8 (alive) or 5 (eliminated) players until "Show all N" is tapped.

#### Scenario: Short list
- **WHEN** 38 players are alive
- **THEN** 8 are shown with a "Show all 38" button, and tapping it shows all 38

#### Scenario: Elimination order
- **WHEN** players went out in weeks 2, 3 and 4
- **THEN** the week 4 players are listed first

#### Scenario: Lists with nobody in them
- **WHEN** nobody has been eliminated
- **THEN** the Eliminated list says "Nobody yet"

### Requirement: Pick 'em summary and leaderboard
The system SHALL show, for a pick 'em pool, a summary card with the viewer's rank phrase ("T4 tied for 4th of 41 players", or "4th of 41 players" when not tied) and "31 points · 7 behind the leader" (or "Leading the pool" when the viewer is level with the leader), the pool total card when there is a total, and a leaderboard "after week W" listing players by points, highest first, with each player's rank, name and "N pts", ties in alphabetical order, and at most 8 shown until "Show all N". Tied players SHALL share a rank written "T4", and the next player SHALL take the rank their position implies (a four-way tie for 3rd is followed by 7th). The note "Points update as the brewery adds game results." SHALL be shown.

#### Scenario: Shared rank
- **WHEN** two players are tied for 4th with 31 points
- **THEN** both show "T4" and the player below them shows 6

#### Scenario: Behind the leader
- **WHEN** the viewer has 31 points and the leader has 38
- **THEN** the card says "31 points · 7 behind the leader"

#### Scenario: Viewer not in the pool
- **WHEN** someone with no entry opens a pick 'em pool's standings
- **THEN** the card shows the pool name and player count without a personal rank

### Requirement: Find a player
The system SHALL provide a "Find a player" field that filters the visible lists to players whose name contains what was typed (ignoring case), searching everyone in the pool and not only those currently shown, and SHALL say "No players match" when none do. Clearing the field SHALL restore the short lists.

#### Scenario: Searching beyond the short list
- **WHEN** a player types "priya" and Priya is the 30th alive player
- **THEN** Priya is shown even though the short list ends at 8

#### Scenario: No match
- **WHEN** the typed text matches nobody
- **THEN** "No players match" is shown

### Requirement: Only your own row leads anywhere
The system SHALL mark the viewer's own row "You" and make it a link to the viewer's own pick screen, and SHALL show every other player's name as plain text.

#### Scenario: Other players
- **WHEN** a player views Standings
- **THEN** exactly one row (their own) is a link

### Requirement: Pool tabs and the Standings tab
The system SHALL show a row of tabs, one per pool the viewer is in, at the top of Standings when there is more than one, each opening that pool's standings. The Standings tab in the bottom bar SHALL open the standings of the pool that needs attention first (the same choice as Home and the Pick tab) and, for someone in no pool, SHALL say "You haven't joined a pool yet" with a link to Home.

#### Scenario: Two pools
- **WHEN** a player in two pools opens Standings
- **THEN** both pool names appear as tabs and the open pool is marked

#### Scenario: Tab with no pools
- **WHEN** a player in no pool taps the Standings tab
- **THEN** they see "You haven't joined a pool yet" and a link to Home

### Requirement: A finished season says so
The system SHALL title the lists "Final standings" and the week line "Final" instead of "After week W" once every game of the season is decided or the pool is completed.

#### Scenario: Season over
- **WHEN** every game is decided
- **THEN** the screen reads "Final standings"

### Requirement: Standings stay readable on a phone
The system SHALL fit Standings in a 390 pixel wide screen without sideways scrolling, with tap targets of at least 44 pixels for the tabs, the search field and the Show all buttons, and with "Please drink responsibly." at the foot.

#### Scenario: Narrow screen
- **WHEN** Standings is opened at 390 pixels wide
- **THEN** nothing scrolls sideways and every button is at least 44 pixels tall
