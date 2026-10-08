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
The system SHALL show every signed-in person the tabs Home, Play and Menu, and SHALL show an Admin tab, last, only to admins.

#### Scenario: A player's tabs
- **WHEN** a signed-in person who is not an admin opens any screen
- **THEN** the tab bar shows exactly Home, Play and Menu

#### Scenario: An admin's tabs
- **WHEN** a signed-in admin opens any screen
- **THEN** the tab bar shows Home, Play, Menu and Admin, in that order

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
- **THEN** the Play tab is highlighted

#### Scenario: A pool's standings
- **WHEN** the person is on a pool's standings, recap or week-by-week view
- **THEN** the Play tab is highlighted

#### Scenario: Menu screens
- **WHEN** the person is on any Menu screen (Drinks, Kitchen, Music or Calendar)
- **THEN** the Menu tab is highlighted

#### Scenario: Any admin screen
- **WHEN** an admin is on any admin screen
- **THEN** the Admin tab is highlighted

#### Scenario: Me
- **WHEN** the person is on the Me page
- **THEN** no tab is highlighted

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

### Requirement: The Play tab goes to the right place
The system SHALL send the Play tab to the pool screen the person was last on, on this device, when they are still in that pool. Otherwise it SHALL send them to the pick screen of the entry that needs attention first (the same choice as Home). It SHALL say plainly when they have joined no pool, with a link to Home. The old addresses `/pick` and `/standings` SHALL lead to the same place as the Play tab.

#### Scenario: First time
- **WHEN** a person in one pool, who has never opened a pool screen on this device, taps Play
- **THEN** they land on that pool's pick screen

#### Scenario: Returning to Standings
- **WHEN** a person last viewed a pool's standings, went to Home, and taps Play
- **THEN** they land on that pool's standings

#### Scenario: Remembers the pool
- **WHEN** a person in two pools last viewed the second pool's pick screen and taps Play
- **THEN** they land on the second pool's pick screen, not the pool that needs attention first

#### Scenario: Remembered pool is gone
- **WHEN** the remembered pool is one the person is no longer in
- **THEN** Play falls back to the pick screen of the entry that needs attention first

#### Scenario: No pools
- **WHEN** a person who has joined no pool taps Play
- **THEN** they are told to join a pool first, with a link to Home

#### Scenario: Old addresses
- **WHEN** a person opens `/pick` or `/standings`
- **THEN** they land where the Play tab would take them

### Requirement: A pool's screens have their own tabs
The system SHALL show a tab strip at the top of each pool screen with Pick and Standings, marking the one the person is on, and SHALL keep the existing row of pool names (shown when the person is in more than one pool) beneath it. The strip SHALL be built so another tab can be added without changing the rest of the screen, but SHALL NOT show a tab that has no content.

#### Scenario: Switching between Pick and Standings
- **WHEN** a person on a pool's pick screen taps Standings in the strip
- **THEN** they see that pool's standings and Standings is marked

#### Scenario: Switching pools keeps the screen
- **WHEN** a person in two pools is on the first pool's standings and taps the second pool's name
- **THEN** they see the second pool's standings

#### Scenario: Pick for an entry that is out
- **WHEN** a person who is out of a pool taps Pick in the strip
- **THEN** they see their "Your season" view, as before

#### Scenario: No Stats tab yet
- **WHEN** a person opens any pool screen
- **THEN** the strip shows Pick and Standings only

### Requirement: Play sections appear only when they have content
The system SHALL organise Play into the sections Games, Pools and Leagues, and SHALL show a section only when it has something to open. While only one section is showing, the system SHALL NOT show a section bar at all.

#### Scenario: Only pools exist
- **WHEN** a person opens Play and only Pools has content
- **THEN** no section bar is shown and they land on their pool

#### Scenario: A second section gains content
- **WHEN** a section other than Pools gains content
- **THEN** the section bar appears with every section that has content, in the order Games, Pools, Leagues

### Requirement: The weekly pick stays one tap away
The system SHALL keep the Home hero's call to action leading straight to the pick screen of the entry that needs a pick, and the join and invite flows leading to the pick screen, without passing through Play.

#### Scenario: Hero shortcut
- **WHEN** a person with a pick to make taps the Home hero
- **THEN** they land on that entry's pick screen
