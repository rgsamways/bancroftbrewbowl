## MODIFIED Requirements

### Requirement: Pool tabs and the Standings tab
The system SHALL show a row of tabs, one per pool the viewer is in, at the top of Standings when there is more than one, each opening that pool's standings. Standings SHALL be reached through the Play tab and the pool's Standings tab (see the app-shell spec), and for someone in no pool Play SHALL say "You haven't joined a pool yet" with a link to Home.

#### Scenario: Two pools
- **WHEN** a player in two pools opens Standings
- **THEN** both pool names appear as tabs and the open pool is marked

#### Scenario: Tab with no pools
- **WHEN** a player in no pool taps the Play tab
- **THEN** they see "You haven't joined a pool yet" and a link to Home
