## ADDED Requirements

### Requirement: Most picked follows the pool's reveal rule
The TV data SHALL include the most picked teams only once the pool's `reveal_picks` rule has revealed the current week: at the lock for `at_lock`, and after every game of the week has a result for `after_final_game`. Before that the list SHALL be empty and the page SHALL say when it will show.

#### Scenario: Later reveal on the TV
- **WHEN** a pool uses `after_final_game` and the week has locked but a game is still undecided
- **THEN** the TV shows no most-picked list and says it shows when the week's games are final
