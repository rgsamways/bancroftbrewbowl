## ADDED Requirements

### Requirement: Settings has the reveal rule
The pool Settings screen SHALL offer "When other players' picks show" with the choices "When the week locks" and "After the week's last game is final", with a line explaining the second choice. It SHALL be saved and locked with the other rules, and refused by the server on a locked pool like any other rule change.

#### Scenario: Choosing the later reveal
- **WHEN** an admin picks "After the week's last game is final" on an unlocked pool and saves
- **THEN** the pool's rules carry `reveal_picks: after_final_game`

#### Scenario: Locked pool
- **WHEN** the pool's rules are locked
- **THEN** the choice cannot be changed until the rules are unlocked
