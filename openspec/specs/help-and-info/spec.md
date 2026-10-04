# help-and-info Specification

## Purpose
Plain-language help for players and admins, a home-screen install prompt, and a printable table card with a QR code.

## Requirements

### Requirement: How to play
The system SHALL give every signed-in person a How to play page at `/help`, reached from the Me page, with short answers in three groups: the two games (Survivor and Pick 'em), picking (when picks lock, how to change a pick, when results show up) and your account (who can play, how to sign in, changing your name or email). It SHALL say that you must be 19 or older and that sign-in is by an emailed link, or by a password if you set one.

#### Scenario: Open from Me
- **WHEN** a signed-in player taps How to play on the Me page
- **THEN** they see the page with the three groups and a way back to Me

#### Scenario: Sign-in wording
- **WHEN** the page explains signing in
- **THEN** it mentions the emailed link and the optional password, and does not say there is no password

### Requirement: Admin guide
The system SHALL give admins an Admin guide at `/admin/guide`, reached from More, with answers in three groups: every week (enter results, a wipeout that needs attention, posting to From the brewery), setting up (create a pool, lock the rules, add a player, set the pool total) and if something goes wrong (a wrong result, a player who can't sign in, a missing schedule). It SHALL mention that a decision about your own entry needs another admin to confirm. Players SHALL be sent away from it.

#### Scenario: Open from More
- **WHEN** an admin taps Admin guide on More
- **THEN** they see the guide

#### Scenario: A player
- **WHEN** a person who is not an admin opens the guide address
- **THEN** they are sent away and no admin information is shown

### Requirement: Add to home screen
The system SHALL show on Home a card inviting the player to add Brew Bowl to their home screen, with three steps (tap the Share button, choose Add to Home Screen, tap Add) and a "Not now" button. It SHALL NOT show the card when the app is already running from the home screen, and SHALL stop showing it on that phone after "Not now".

#### Scenario: First visit in a browser
- **WHEN** a player opens Home in a browser tab and has not dismissed the card
- **THEN** the card is shown

#### Scenario: Not now
- **WHEN** the player taps "Not now"
- **THEN** the card is hidden and stays hidden on later visits on that phone

#### Scenario: Already installed
- **WHEN** the app is opened from the home screen
- **THEN** the card is not shown

### Requirement: Table card
The system SHALL give admins a printable table card at `/admin/table-card`, reached from More, showing "Play Brew Bowl on your phone", a QR code that opens the public menu page, the web address and "Please drink responsibly.", and a Print button. When printed, only the card SHALL appear.

#### Scenario: The code
- **WHEN** an admin opens the table card
- **THEN** a QR code is shown that encodes the address of the public menu page

#### Scenario: Printing
- **WHEN** the page is printed
- **THEN** the app header, tab bar and Print button are not printed

#### Scenario: A player
- **WHEN** a person who is not an admin opens the table card address
- **THEN** they are sent away
