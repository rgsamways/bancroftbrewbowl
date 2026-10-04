# app-shell Specification

## Purpose

The frame that every signed-in screen sits in: a header, a bottom tab bar suited to a phone held in one hand, the tabs each kind of person sees, where each tab leads, and the colours and font used throughout.

## Requirements

### Requirement: Signed-in screens share one phone-first frame
The system SHALL show every signed-in screen inside a frame with a header at the top and a tab bar fixed to the bottom. The header SHALL show the Brew Bowl logo and name, which lead to Home, and an avatar showing the person's initials, which leads to the Me page. There SHALL be no side navigation, no top-bar menu button and no help button.

#### Scenario: Header on a signed-in screen
- **WHEN** a signed-in person opens any screen
- **THEN** the header shows the logo, the name, and an avatar with their initials

#### Scenario: Logo goes home
- **WHEN** they tap the logo or the name
- **THEN** they land on Home

#### Scenario: Avatar opens Me
- **WHEN** they tap the avatar
- **THEN** they land on the Me page

#### Scenario: Old navigation is gone
- **WHEN** a signed-in person opens any screen on a phone
- **THEN** there is no hamburger button, no slide-out sidebar, and no help drawer

### Requirement: The tab bar shows the right tabs for the person
The system SHALL show every signed-in person the tabs Home, Pick and Standings, and SHALL show an Admin tab, last, only to admins. There SHALL be no Menu tab until a menu exists.

#### Scenario: A player's tabs
- **WHEN** a signed-in person who is not an admin opens any screen
- **THEN** the tab bar shows exactly Home, Pick and Standings

#### Scenario: An admin's tabs
- **WHEN** a signed-in admin opens any screen
- **THEN** the tab bar shows Home, Pick, Standings and Admin, in that order

#### Scenario: The Admin tab is only a shortcut
- **WHEN** a person who is not an admin opens an admin address directly
- **THEN** the server still refuses admin actions exactly as before, whether or not a tab was shown

### Requirement: The current tab is marked
The system SHALL highlight the tab that matches the screen the person is on, and SHALL highlight none while they are on the Me page.

#### Scenario: Home
- **WHEN** the person is on Home
- **THEN** the Home tab is highlighted

#### Scenario: A pool's pick screen
- **WHEN** the person is on a pool's pick screen
- **THEN** the Pick tab is highlighted

#### Scenario: A pool's standings
- **WHEN** the person is on a pool's standings
- **THEN** the Standings tab is highlighted

#### Scenario: Any admin screen
- **WHEN** an admin is on any admin screen
- **THEN** the Admin tab is highlighted

#### Scenario: Me
- **WHEN** the person is on the Me page
- **THEN** no tab is highlighted

### Requirement: The Pick tab goes to the right place
The system SHALL send the Pick tab to the person's pick screen when they have exactly one pool entry and are still alive in it; otherwise it SHALL show a short list of their pools, each leading to that pool's pick screen if they are alive in it or its standings if they are out, and SHALL say plainly when they have joined no pool.

#### Scenario: One pool, still alive
- **WHEN** a person with a single entry, still alive, taps Pick
- **THEN** they land directly on that pool's pick screen

#### Scenario: Several pools
- **WHEN** a person with more than one entry taps Pick
- **THEN** they see a list of their pools, where alive entries lead to the pick screen and eliminated entries lead to standings and are marked as out

#### Scenario: One pool, but out
- **WHEN** a person whose only entry is eliminated taps Pick
- **THEN** they see that pool in the list, marked as out, leading to its standings

#### Scenario: No pools
- **WHEN** a person who has joined no pool taps Pick
- **THEN** they are told to join a pool first, with a link to Home

### Requirement: The Standings tab goes to the right place
The system SHALL send the Standings tab straight to the pool's standings when the person is in exactly one pool, SHALL otherwise show a short list of their pools each leading to its standings, and SHALL say plainly when they have joined no pool.

#### Scenario: One pool
- **WHEN** a person in a single pool taps Standings
- **THEN** they land directly on that pool's standings

#### Scenario: Several pools
- **WHEN** a person in more than one pool taps Standings
- **THEN** they see a list of their pools, each leading to its standings

#### Scenario: No pools
- **WHEN** a person who has joined no pool taps Standings
- **THEN** they are told to join a pool first, with a link to Home

### Requirement: Nothing that was reachable becomes unreachable
The system SHALL keep every page that the old sidebar led to reachable from the new frame, including the admin pages Pools, Schedule and Promotions, and SHALL keep signing out available.

#### Scenario: Admin pages
- **WHEN** an admin opens any admin page
- **THEN** a sub-navigation under the header offers Pools, Schedule and Promotions, and each leads to its page

#### Scenario: Signing out
- **WHEN** a signed-in person taps Sign out on the Me page
- **THEN** they are signed out and shown the sign-in page

#### Scenario: Existing pages still work
- **WHEN** a person opens Home, Me, a pool's standings, a pool's pick screen or an admin page
- **THEN** each works as it did before this change, now inside the new frame

### Requirement: The frame fits a phone
The system SHALL fit the frame to a 390 pixel wide screen with no sideways scrolling, SHALL make every tab and header control at least 44 pixels tall to tap, and SHALL keep page content clear of the fixed tab bar so nothing is hidden behind it.

#### Scenario: No sideways scroll
- **WHEN** any frame screen is opened on a 390 pixel wide screen
- **THEN** the page does not scroll sideways

#### Scenario: Content clear of the bar
- **WHEN** a long page is scrolled to its end
- **THEN** its last line is fully visible above the tab bar

#### Scenario: Tap size
- **WHEN** the tabs and header controls are measured
- **THEN** each is at least 44 pixels tall

### Requirement: One look across the app
The system SHALL use the v2 colours and font on every screen: a near-black background, a copper accent, and the Inter typeface. Controls in the frame SHALL be legible on the dark background, with the highlighted tab and links meeting a 4.5 to 1 contrast ratio.

#### Scenario: Colours and font
- **WHEN** any screen is opened
- **THEN** the background is near-black, accents are copper, and text is set in Inter

#### Scenario: Highlighted tab contrast
- **WHEN** a tab is highlighted
- **THEN** its copper text against the bar's dark background has a contrast ratio of at least 4.5 to 1
