## ADDED Requirements

### Requirement: A pool chooses when other players' picks become visible
Each pool SHALL have a rule `reveal_picks` with the values `at_lock` (the default, and the behaviour of a pool that has no such rule) and `after_final_game`. With `at_lock`, other players' picks for a week become visible when the week locks. With `after_final_game`, they become visible only once every game of that week has a result. A player's own picks SHALL always be visible to them. Before the reveal an admin SHALL see only that a player has picked, never the team or result. The rule applies to both pool types and to every route that returns picks.

#### Scenario: Default
- **WHEN** a pool has no `reveal_picks` rule and the week has locked
- **THEN** other players' picks for that week are visible

#### Scenario: Held until the last game is final
- **WHEN** a pool uses `after_final_game`, the week has locked and one game still has no result
- **THEN** a player sees none of the other players' picks for that week, and an admin sees only "picked"

#### Scenario: Revealed after the last game
- **WHEN** every game of that week has a result
- **THEN** all picks for that week are visible to every signed-in player

#### Scenario: Own picks
- **WHEN** a pool uses `after_final_game` and the week has not been revealed
- **THEN** a player still sees their own picks in full
