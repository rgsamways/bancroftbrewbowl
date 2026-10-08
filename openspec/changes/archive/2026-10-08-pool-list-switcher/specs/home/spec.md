## MODIFIED Requirements

### Requirement: Home has a pool switcher when there are several pools
The system SHALL show, when the player has more than one entry, a compact control under the header with the shown pool's name and a small arrow. Opening it SHALL list the player's pools, each with its name and a short line saying what needs doing, with the shown pool marked. Choosing a pool SHALL show that pool's hero without reloading the page and close the list. With one entry there SHALL be no switcher.

#### Scenario: Switching
- **WHEN** a player in two pools opens the control and chooses the other pool
- **THEN** the hero changes to that pool's state, buttons and countdown, and the list closes

#### Scenario: Many or long names
- **WHEN** a player is in four pools with long names
- **THEN** the control and its list fit the screen without sideways scrolling

#### Scenario: One pool
- **WHEN** a player is in exactly one pool
- **THEN** no switcher is shown
