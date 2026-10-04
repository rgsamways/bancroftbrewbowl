# tv-standings Specification

## Purpose
A signed-in, full-screen 16:9 standings page for the bar's TV: the alive count and names (or the pick 'em leaderboard), the lock status, the most picked teams after the lock, and a QR code to play.

## Requirements

### Requirement: One request supplies the TV page
The system SHALL provide `GET /pools/:poolId/tv`, for a signed-in player only (401 signed out, 404 for no such pool), returning the pool's name, kind, the current week, a status (`open`, `locked`, `season_over` or `no_games`), the number of players and, for survivor, the number still alive and their names; for pick 'em, the top 10 of the leaderboard with shared ranks and points. It SHALL contain names, counts and points only, and SHALL NOT contain any email address or any individual's pick.

#### Scenario: Signed out
- **WHEN** the TV data is requested without a session
- **THEN** the request is refused as not signed in

#### Scenario: Survivor data
- **WHEN** a signed-in player requests the TV data for a survivor pool with 64 players of whom 38 are alive
- **THEN** the answer says 38 of 64 and lists the 38 alive names

#### Scenario: No emails or picks
- **WHEN** the TV data is requested for any pool
- **THEN** the answer contains no email address and no one's individual pick

### Requirement: Most picked shows only after the lock
For a survivor pool the TV data SHALL include the three most picked teams of the current week with each team's share (picks for the team out of the players who picked that week) only once that week has locked. Before the lock it SHALL contain no pick counts at all.

#### Scenario: Before the lock
- **WHEN** the current week has not locked
- **THEN** the most picked list is empty and the status is `open`

#### Scenario: After the lock
- **WHEN** the week has locked and 24 of 64 players picked the Chiefs
- **THEN** the Chiefs appear first with 38%

### Requirement: The TV page
The system SHALL show, at `/pool/:poolId/tv` for a signed-in player, a full-screen 16:9 page with no header or tabs: the brewery name, the pool and week, the big alive count with "of N still alive" (survivor) or the leaderboard (pick 'em), a status line ("Picks open", "Picks locked · games underway", "Season complete"), the most picked list when available, and a QR code to the site with "Play on your phone". It SHALL refresh its data every 30 seconds without a reload.

#### Scenario: Survivor TV page
- **WHEN** a signed-in player opens the TV page for a survivor pool after the lock
- **THEN** it shows the alive count, the names, "Picks locked · games underway" and the most picked list

#### Scenario: Pick 'em TV page
- **WHEN** a signed-in player opens the TV page for a pick 'em pool
- **THEN** it shows the top of the leaderboard in place of the alive names

#### Scenario: Signed out
- **WHEN** someone who is not signed in opens the TV address
- **THEN** they are asked to sign in first

### Requirement: Most picked follows the pool's reveal rule
The TV data SHALL include the most picked teams only once the pool's `reveal_picks` rule has revealed the current week: at the lock for `at_lock`, and after every game of the week has a result for `after_final_game`. Before that the list SHALL be empty and the page SHALL say when it will show.

#### Scenario: Later reveal on the TV
- **WHEN** a pool uses `after_final_game` and the week has locked but a game is still undecided
- **THEN** the TV shows no most-picked list and says it shows when the week's games are final
