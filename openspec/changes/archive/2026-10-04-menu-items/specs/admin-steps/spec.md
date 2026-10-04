## MODIFIED Requirements

### Requirement: Admin screens have their own tab bar
The system SHALL show on admin screens a bottom tab bar with Next step, Results, Menu, Pools and More, in that order, marking the current one, instead of the player tab bar. The screens that walk through a task (results one game at a time, the wipeout decision, adding a menu item) SHALL show no tab bar, only a Back control, a "Step N of M" label where there are steps, and a Leave control. The bar SHALL fit a 390 pixel wide screen with tap targets of at least 44 pixels.

#### Scenario: An admin opens the admin area
- **WHEN** an admin opens Admin from the player tab bar
- **THEN** they see Next step, Results, Menu, Pools and More, with Next step marked

#### Scenario: A task screen
- **WHEN** an admin starts entering results one at a time
- **THEN** the tab bar is gone and Back, "Step 1 of N" and Leave are shown

#### Scenario: A player
- **WHEN** a person who is not an admin opens an admin address
- **THEN** they are sent away and no admin information is shown
