# pick-grid Specification

## Purpose
Gives Standings a week-by-week view of who picked which team (survivor) or how many points each player scored (pick 'em), built only from picks the reveal rules already allow other players to see.

## Requirements

### Requirement: One request supplies the week-by-week grid
The system SHALL provide `GET /pools/:poolId/pick-grid`, for a signed-in player only (401 signed out, 404 for no such pool), returning every week from 1 to the current week (every week once the season is over), and a row per player with status, elimination week, whether the row is the caller's, and a cell per week. Names SHALL follow the safe-name rule and the answer SHALL contain no email address. A past week in which nobody in the pool has a pick SHALL be marked as a free-pass week, and every row's cell for it SHALL say so. The current week with no picks yet SHALL NOT be a free-pass week.

#### Scenario: Signed out
- **WHEN** the grid is requested without a session
- **THEN** the request is refused as not signed in

#### Scenario: Late start
- **WHEN** weeks 1 to 4 have no picks in the pool and week 5 is the current week
- **THEN** weeks 1 to 5 are columns, weeks 1 to 4 are free-pass weeks for every row, and week 5 is not

#### Scenario: Current week not picked yet
- **WHEN** nobody has picked yet for the current week
- **THEN** its cells are blank, not free pass

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

### Requirement: Rows are ordered like a narrowing triangle
In a survivor pool the rows SHALL be ordered alive players first (A to Z), then eliminated players with the longest-lasting first (latest elimination week first, ties by name). No row SHALL be moved to the top for being the viewer's. In a pick 'em pool the rows SHALL be ordered by total points, ties by name, with no pinned row.

#### Scenario: Triangle
- **WHEN** players were eliminated in weeks 9, 7, 7, 4 and 2 and two are still alive
- **THEN** the two alive come first, then the week 9 exit, the two week 7 exits by name, the week 4 exit, and the week 2 exit last

#### Scenario: Viewer is not pinned
- **WHEN** the viewer was eliminated in week 4 among players eliminated later
- **THEN** their row sits in its week 4 place, highlighted
