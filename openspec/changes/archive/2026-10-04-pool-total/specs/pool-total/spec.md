## Purpose

Lets an admin type in a pool's total so players can see it on Standings, while the app itself never handles, collects or pays out money.

## ADDED Requirements

### Requirement: A pool can have a display-only total
The system SHALL let a pool have one optional total, held as a number of dollars and cents. A pool created before this change, or one an admin has cleared, SHALL have no total.

#### Scenario: New and existing pools
- **WHEN** a pool has never had a total set
- **THEN** it has no total and nothing about money is shown for it

### Requirement: Only admins set the pool total
The system SHALL allow only admins to set, change or clear a pool's total. Players and signed-out visitors SHALL be refused.

#### Scenario: Admin sets the total
- **WHEN** an admin saves 320 as the pool total
- **THEN** the pool's total is $320.00

#### Scenario: Player tries to set it
- **WHEN** a player who is not an admin tries to change the total
- **THEN** the request is refused with a "forbidden" answer and the total is unchanged

#### Scenario: Signed out
- **WHEN** a request to change the total arrives without a session
- **THEN** it is refused as not signed in and the total is unchanged

### Requirement: The total can be changed at any time
The system SHALL allow the total to be set, changed or cleared in every pool status, including after the pool's rules are locked.

#### Scenario: Locked pool
- **WHEN** an admin changes the total of a pool whose rules are locked
- **THEN** the change is saved and the rules are unchanged

### Requirement: The total must be a sensible amount
The system SHALL accept a total of zero or more, up to $1,000,000.00, with at most two decimal places, and SHALL refuse anything else with a plain message that nothing was saved. An empty field SHALL clear the total.

#### Scenario: Amount with cents
- **WHEN** an admin saves "320.50"
- **THEN** the total is $320.50

#### Scenario: Negative amount
- **WHEN** an admin saves "-5"
- **THEN** they see "Enter an amount of $0 or more." and nothing is saved

#### Scenario: Not a number
- **WHEN** an admin saves "lots"
- **THEN** they see "Enter the amount as a number, like 320 or 320.50." and nothing is saved

#### Scenario: Too large
- **WHEN** an admin saves an amount above $1,000,000
- **THEN** they see "That amount is too large." and nothing is saved

#### Scenario: Clearing
- **WHEN** an admin empties the field and saves
- **THEN** the pool has no total and the card disappears from Standings

### Requirement: Standings show the total with a no-money line
The system SHALL show, on Standings for a pool that has a total, a "Pool total" card with the amount and the line "Cash handled at the bar, not in this app." The amount SHALL read as whole dollars when there are no cents (for example $320) and with two decimals otherwise (for example $320.50). A pool with no total SHALL show no card. This applies to survivor and pick 'em pools alike.

#### Scenario: Whole dollars
- **WHEN** a player opens Standings for a pool whose total is $320.00
- **THEN** they see "Pool total $320" and "Cash handled at the bar, not in this app."

#### Scenario: With cents
- **WHEN** the total is $320.50
- **THEN** they see "Pool total $320.50"

#### Scenario: No total
- **WHEN** the pool has no total
- **THEN** no Pool total card is shown

### Requirement: The admin field explains that no money moves
The system SHALL show the admin a "Pool total" field in the pool's settings, labelled "Shown to players on Standings", with the note that they type the number, the app only shows it and never handles money, and that it can be changed at any time even while the rules are locked.

#### Scenario: Locked pool settings
- **WHEN** an admin opens the settings of a pool whose rules are locked
- **THEN** the other settings are read-only and the Pool total field and its Save button are still usable

### Requirement: The app never handles money
The system SHALL NOT collect, hold, pay, refund or calculate any money, and SHALL NOT derive the total from anything. The total SHALL be only the number an admin typed.

#### Scenario: Players join and win
- **WHEN** players join a pool, are eliminated or win
- **THEN** the pool total does not change
