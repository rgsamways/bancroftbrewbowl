## ADDED Requirements

### Requirement: One request supplies the recap
The system SHALL provide `GET /pools/:poolId/recap?week=N`, for a signed-in player only (401 signed out, 404 for no such pool), defaulting to the latest fully decided week in which the pool had picks (a week before the pool started has nothing to recap). It SHALL answer 404 for a week that is not fully decided, or when there is no such week, and 400 for a week that is not a number. For survivor it SHALL return players left (alive at the end of that week) and total, players out that week, the most picked team with its share, the biggest upset, and the caller's own pick and result. For pick 'em it SHALL return the caller's correct picks out of the week's games, points, rank and the leader's points (pick 'em has no most picked or upset). It SHALL contain no email address and no one else's pick.

#### Scenario: Undecided week
- **WHEN** a recap is requested for a week with games still pending
- **THEN** the answer is "not found"

#### Scenario: Survivor recap
- **WHEN** week 4 is decided, 9 players were eliminated in it and 38 of 64 are alive
- **THEN** the recap says 38 of 64 left and 9 out this week

#### Scenario: No emails or others' picks
- **WHEN** a recap is requested
- **THEN** it contains no email address and no other player's pick

### Requirement: Biggest upset
For a survivor pool the biggest upset SHALL be the game of that week with a result whose winning team was picked by the smallest share of the players who picked that week, shown as "Winner over Loser". Equal shares SHALL go to the game whose losing team more players picked, then to the earlier kickoff. When nobody picked that week, or no game has a winner, there SHALL be no upset.

#### Scenario: Lowest share wins
- **WHEN** the Jets beat the Bills and only 3% of players picked the Jets, the smallest share among winners
- **THEN** the upset is "Jets over Bills"

#### Scenario: No picks
- **WHEN** no one picked that week
- **THEN** the recap has no upset and no most picked team

### Requirement: The recap page and Share
The system SHALL show the recap at `/pool/:poolId/recap` as a phone page inside the app frame, with "Back to Home". A Share button SHALL share a short text (the pool, the week, how the player did and the site address) with the phone's share sheet, or copy it when no share sheet exists. The text SHALL NOT include anyone else's picks.

#### Scenario: Share without a share sheet
- **WHEN** the browser has no share sheet and the player taps Share
- **THEN** the text is copied and the button says it was copied

### Requirement: Wipeouts can delay "out this week"
Players held alive by a waiting wipeout SHALL still count as alive in the recap until an admin resolves it.

#### Scenario: Waiting wipeout
- **WHEN** a wipeout for the week is waiting for an admin
- **THEN** the recap counts those players as alive
