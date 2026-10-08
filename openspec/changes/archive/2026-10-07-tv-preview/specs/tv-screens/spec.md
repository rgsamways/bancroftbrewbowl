## ADDED Requirements

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
