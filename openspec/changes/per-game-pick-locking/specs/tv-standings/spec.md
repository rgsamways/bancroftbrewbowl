## ADDED Requirements

### Requirement: Most picked in a per-game pool counts only started games
For a per-game pool with the reveal rule `at_lock`, the TV most-picked list SHALL count only picks whose game has started, with shares taken among those picks, so a part-played week never shows what unstarted picks are. With the rule `after_final_game` it SHALL stay empty until the week is final.

#### Scenario: Only Thursday has started
- **WHEN** only the Thursday game has started
- **THEN** most picked reflects only the picks for Thursday's two teams
