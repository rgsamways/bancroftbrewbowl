## MODIFIED Requirements

### Requirement: The tab bar shows the right tabs for the person
The system SHALL show every signed-in person the tabs Home, Pick, Standings and Menu, and SHALL show an Admin tab, last, only to admins.

#### Scenario: A player's tabs
- **WHEN** a signed-in person who is not an admin opens any screen
- **THEN** the tab bar shows exactly Home, Pick, Standings and Menu

#### Scenario: An admin's tabs
- **WHEN** a signed-in admin opens any screen
- **THEN** the tab bar shows Home, Pick, Standings, Menu and Admin, in that order

#### Scenario: The Admin tab is only a shortcut
- **WHEN** a person who is not an admin opens an admin address directly
- **THEN** the server still refuses admin actions exactly as before, whether or not a tab was shown
