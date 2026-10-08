## MODIFIED Requirements

### Requirement: The Play tab goes to the right place
The system SHALL show, when the person is in two or more pools, a list of their pools when they tap Play. With exactly one pool, the system SHALL send them to the pool screen they were last on, on this device, or else to that entry's pick screen. It SHALL say plainly when they have joined no pool, with a link to Home. The old addresses `/pick` and `/standings` SHALL lead to the same place as the Play tab.

#### Scenario: One pool, first time
- **WHEN** a person in one pool, who has never opened a pool screen on this device, taps Play
- **THEN** they land on that pool's pick screen

#### Scenario: One pool, returning to Standings
- **WHEN** a person in one pool last viewed its standings, went to Home, and taps Play
- **THEN** they land on that pool's standings

#### Scenario: Several pools
- **WHEN** a person in two or more pools taps Play
- **THEN** they see a list of their pools, not a pool screen

#### Scenario: No pools
- **WHEN** a person who has joined no pool taps Play
- **THEN** they are told to join a pool first, with a link to Home

#### Scenario: Old addresses
- **WHEN** a person opens `/pick` or `/standings`
- **THEN** they land where the Play tab would take them

## ADDED Requirements

### Requirement: The pool list shows what needs doing
The system SHALL show one card per pool in the pool list, each with the pool's name, its type (Survivor or Pick 'em), the person's standing in it (alive or out; or rank and points) and a line saying what needs doing, ordered with pools that need a pick first. Tapping a card SHALL open that pool on the screen last used on this device (Pick or Standings), defaulting to Pick. The list SHALL work the same for any number of pools, with no sideways scrolling.

#### Scenario: Cards
- **WHEN** a person in a Survivor pool they are alive in and a Pick 'em pool opens the list
- **THEN** each pool has a card with its name, type, standing and a line such as "Pick due Thu 8:15 PM" or "Picks made"

#### Scenario: Pools that need a pick come first
- **WHEN** one pool needs a pick and the other is locked
- **THEN** the pool that needs a pick is listed first

#### Scenario: Opening a pool
- **WHEN** a person last viewed Standings and taps a pool's card
- **THEN** that pool opens on its standings

#### Scenario: Many pools
- **WHEN** a person is in four pools with long names
- **THEN** every card is fully visible by scrolling down, and the page does not scroll sideways

### Requirement: Pool screens name their pool and lead back to the list
The system SHALL show the pool's name as a header at the top of each pool screen (Pick and Standings), above the Pick | Standings strip. When the person is in two or more pools the header SHALL be a control that opens the pool list; with one pool it SHALL be plain text. The system SHALL NOT show a row of pool-name chips on pool screens.

#### Scenario: Switching from the pick screen
- **WHEN** a person in two pools is on one pool's pick screen and taps the pool name
- **THEN** they see the pool list and can open the other pool

#### Scenario: One pool
- **WHEN** a person in one pool opens a pool screen
- **THEN** the pool name is shown and is not a control

#### Scenario: No chips
- **WHEN** a person in two pools opens Standings
- **THEN** there is no row of pool-name chips
