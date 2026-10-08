# tv-screens Specification

## Purpose
Lets the brewery run one or more TVs, each opened with its own private link (no sign-in) and each playing a chosen playlist, with a standing invitation to play on a phone.

## Requirements

### Requirement: Screens and their private links
The system SHALL support named screens, one per physical TV, each with a private link of the form `/tv/<code>` where the code is long, random and unguessable (at least 256 bits). Only the god-user SHALL create, rename or delete a screen, see or copy its link, or reset its link. A screen SHALL have at most one playlist and a setting for whether the QR strip shows (on by default). There SHALL be at most 10 screens and names SHALL be 1 to 60 characters and unique ignoring case.

#### Scenario: Creating a screen
- **WHEN** the god-user creates "Bar TV"
- **THEN** it exists with a new private link, the QR strip on and no playlist

#### Scenario: An ordinary admin
- **WHEN** an admin who is not the god-user tries to create or delete a screen, rename it, or ask for its link
- **THEN** the request is refused (403) and the response contains no link

#### Scenario: Resetting a link
- **WHEN** the god-user resets "Bar TV"'s link
- **THEN** the old link stops working at once, the new link works, and the screen's playlist and settings are unchanged

### Requirement: Any admin chooses what a screen plays
The system SHALL let any admin change which playlist a screen plays and turn its QR strip on or off, and SHALL let them see the list of screens (names, playlist, QR setting) without the links.

#### Scenario: Switching a playlist
- **WHEN** an admin sets "Bar TV" to "Holiday"
- **THEN** within the screen's next refresh (30 seconds) the TV plays "Holiday"

#### Scenario: No playlist
- **WHEN** an admin sets a screen to no playlist
- **THEN** the TV shows a calm "Nothing to show yet" message with the screen's name

### Requirement: The public TV feed
The system SHALL serve a screen's content at a public address keyed by its private code, with no sign-in, in one request: the screen's name, QR setting, and its playlist's enabled slides in order, each with its content. An unknown or reset code SHALL give the same plain not-found answer and reveal nothing. The feed SHALL NOT be cached, and SHALL NOT include any email address, any pick, or any person's details beyond what the existing signed-in TV page shows (display names, counts and points). The feed SHALL follow the pool's reveal rule for "most picked" exactly as the signed-in TV page does.

#### Scenario: A valid code
- **WHEN** a TV loads its feed
- **THEN** it receives the slides in order with each slide's content

#### Scenario: A wrong or reset code
- **WHEN** someone requests a code that does not exist or was reset
- **THEN** they get a not-found answer with nothing about the screens

#### Scenario: Privacy
- **WHEN** a feed includes a Standings slide
- **THEN** it contains no email, no pick, and "most picked" appears only when the pool's reveal rule allows it

### Requirement: The TV player page
The system SHALL show, at `/tv/<code>` with no sign-in and no app header or tabs, a 16:9 page that plays the enabled slides in order, each for its own number of seconds, then repeats. It SHALL refresh its feed every 30 seconds without restarting the rotation, and keep showing the last good content if a refresh fails. Slides: Standings (the pool's TV content), Drinks and Kitchen (the available menu items by section, sold-out items left out, split into pages that fit the screen and shown in turn within the slide's time), and Music (what is coming up, with the next event first). A thin strip along the bottom of every slide SHALL show a QR code and "Play on your phone" when the screen's QR setting is on; on Drinks and Kitchen slides the QR SHALL point to the public menu, on the others to the site's home page.

#### Scenario: Rotation
- **WHEN** a playlist has Standings (15 s), Drinks (20 s) and Music (10 s) all on
- **THEN** the TV shows each for its time in that order and then starts again

#### Scenario: A slide with nothing to show
- **WHEN** the Music slide has no coming events
- **THEN** it is skipped instead of showing an empty slide, and if every slide is skipped the "Nothing to show yet" message shows

#### Scenario: QR strip off
- **WHEN** the screen's QR setting is off
- **THEN** no strip shows on any slide

#### Scenario: Reset link on a running TV
- **WHEN** the link is reset while the TV is showing
- **THEN** on its next refresh the TV shows "This TV link is no longer active" and nothing else

### Requirement: The existing signed-in TV page is unchanged
The system SHALL keep `/pool/:poolId/tv` and its data working as before, for signed-in players.

#### Scenario: Signed-in page
- **WHEN** a signed-in player opens a pool's TV page
- **THEN** it looks and refreshes exactly as before

### Requirement: Admins can preview a screen or a playlist
The system SHALL let any admin preview what a screen or a playlist shows, without the screen's private link. Previewing a screen SHALL play that screen's saved playlist exactly as its TV would (the same slides, order, timing, QR strip setting and screen name). Previewing a playlist SHALL play that saved playlist with the QR strip on, even when no screen plays it. A preview SHALL open full-screen, SHALL look and time itself like a real TV, and SHALL have a Close button that a real TV does not. A preview SHALL show only what is saved and SHALL say so in the admin screens. A preview SHALL be read-only: it SHALL write nothing and record nothing in Activity. Signed-out visitors and players SHALL be refused, an unknown screen or playlist SHALL be not found, and no preview response SHALL contain a screen's private link.

#### Scenario: Previewing a screen
- **WHEN** an admin taps Preview on "Bar TV"
- **THEN** a full-screen page plays Bar TV's playlist as its TV would, with a Close button

#### Scenario: Previewing a playlist nobody plays
- **WHEN** an admin taps Preview on a playlist no screen plays
- **THEN** it plays full-screen with the QR strip, and Close returns to where they were

#### Scenario: Unsaved edits
- **WHEN** an admin has changed a playlist in the editor without saving
- **THEN** Preview shows the saved version and the editor says it shows the saved playlist

#### Scenario: Not an admin
- **WHEN** a player or a signed-out visitor requests a preview
- **THEN** it is refused and nothing is shown

#### Scenario: Same as the TV
- **WHEN** a screen's preview and its TV are loaded at the same moment
- **THEN** they show the same slides in the same order with the same content
