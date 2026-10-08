## MODIFIED Requirements

### Requirement: Pool tabs and the Standings tab
The system SHALL reach Standings through the Play tab and the pool's Standings tab (see the app-shell spec), SHALL switch between pools through the pool list and the pool-name header rather than a row of pool tabs, and for someone in no pool Play SHALL say "You haven't joined a pool yet" with a link to Home.

#### Scenario: Two pools
- **WHEN** a player in two pools opens Standings
- **THEN** the pool's name is shown as a header that opens the pool list, and no row of pool tabs is shown

#### Scenario: Tab with no pools
- **WHEN** a player in no pool taps the Play tab
- **THEN** they see "You haven't joined a pool yet" and a link to Home
