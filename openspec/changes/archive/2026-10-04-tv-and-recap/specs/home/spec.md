## ADDED Requirements

### Requirement: Home links to the latest recap
`GET /me/summary` SHALL carry, for each entry, `recapWeek`: the latest fully decided week in which the pool had picks, or null. Home SHALL show a "Week N recap" card under the hero of the entry in view when `recapWeek` is set, linking to that pool's recap page, and no card when it is null.

#### Scenario: A decided week
- **WHEN** week 4 is fully decided and picks were made
- **THEN** Home shows a "Week 4 recap" card linking to the recap

#### Scenario: Nothing decided yet
- **WHEN** no week is fully decided
- **THEN** Home shows no recap card
