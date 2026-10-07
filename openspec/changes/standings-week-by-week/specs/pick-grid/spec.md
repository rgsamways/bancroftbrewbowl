## ADDED Requirements

### Requirement: One request supplies the week-by-week grid
The system SHALL provide `GET /pools/:poolId/pick-grid`, for a signed-in player only (401 signed out, 404 for no such pool), returning the weeks that have picks in the pool up to the current week, and a row per player with status, elimination week, whether the row is the caller's, and a cell per week. Names SHALL follow the safe-name rule and the answer SHALL contain no email address. Weeks before anyone picked SHALL NOT appear.

#### Scenario: Signed out
- **WHEN** the grid is requested without a session
- **THEN** the request is refused as not signed in

#### Scenario: Late start
- **WHEN** weeks 1 to 4 have no picks in the pool and week 5 does
- **THEN** only week 5 (and later weeks with picks) are columns

### Requirement: The grid shows only what the viewer may already see
Every cell SHALL pass through the same test as the Pick screen: a player's own picks are always shown; another player's pick is shown only once its game has started (a per-game pool) or its week has locked (a whole-week pool), or, for a pool that waits for the week's last game, once every game of that week has a result. Before that the cell SHALL be blank for an ordinary player, and a neutral "picked" marker with no team for an admin.

#### Scenario: Thursday started, Sunday not
- **WHEN** only Thursday's game has started in a per-game pool
- **THEN** another player's Thursday pick shows its team and their Sunday pick is blank

#### Scenario: Waiting pool
- **WHEN** the pool waits until the week's last game is final and a game is still undecided
- **THEN** no other player's picks for that week show

#### Scenario: Own picks
- **WHEN** a player views the grid before their games start
- **THEN** their own row shows their own picks in full

### Requirement: Survivor cells show the team and how the pick is going
In a survivor pool each cell SHALL show the team and the pick's result (won, lost, tied, still to play); a double-pick week SHALL show both teams. A footer SHALL show, for each week, the most picked team among the picks shown and its share. For the viewer it SHALL also say how many teams they have used and how many are left, or that repeats are allowed.

#### Scenario: A result
- **WHEN** a revealed pick's game has been decided
- **THEN** its cell shows the team with a won or lost mark

#### Scenario: Teams left
- **WHEN** the viewer has used 3 teams in a pool that does not allow repeats
- **THEN** the view says 3 used and 29 left

### Requirement: Pick 'em cells show points
In a pick 'em pool each cell SHALL show the number of correct picks that week among the picks shown, out of the week's games, and each row SHALL show a total and a shared rank.

#### Scenario: Weekly points
- **WHEN** a player got 11 of 14 decided games right in a week
- **THEN** their cell shows 11 and their total includes it
