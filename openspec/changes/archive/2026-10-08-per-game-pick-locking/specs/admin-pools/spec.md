## ADDED Requirements

### Requirement: Settings has "When picks lock"
The pool Settings screen SHALL offer "When picks lock" with the choices "At each game's kickoff" and "At the week's first kickoff", with a line explaining each. It SHALL save and lock with the other rules, and the server SHALL refuse a change on a locked pool like any other rule. A pool created in the app SHALL start with "At each game's kickoff"; pools saved before this setting existed SHALL keep "At the week's first kickoff" until an admin changes them.

#### Scenario: New pool
- **WHEN** an admin creates a pool
- **THEN** its rules carry `pick_deadline_rule: per_game_kickoff`

#### Scenario: Existing pool
- **WHEN** an admin opens Settings on a pool saved before the setting
- **THEN** it shows "At the week's first kickoff" and can be changed after unlocking the rules
