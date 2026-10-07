## ADDED Requirements

### Requirement: Standings has a Week by week view
Standings SHALL have a two-way switch, "Standings" and "Week by week", for both pool types. The choice SHALL be kept in the address (`?view=weeks`) so a link opens it directly. The Week by week view SHALL show the grid, keep the player names in view while the weeks scroll sideways, pin the viewer's row at the top, and explain its colours in a short legend. It SHALL fit a 390 pixel wide screen.

#### Scenario: Switching
- **WHEN** a player taps Week by week
- **THEN** the grid replaces the lists, the address carries `view=weeks`, and tapping Standings brings the lists back

#### Scenario: Narrow screen
- **WHEN** the grid is wider than the screen
- **THEN** only the grid scrolls sideways, the names stay put, and the page itself does not scroll sideways
