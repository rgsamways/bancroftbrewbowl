# site-notices Specification

## Purpose
Lets an admin put an important notice at the top of every player page, which each player can close on their own device.

## Requirements

### Requirement: Admins post and remove notices
The system SHALL let any admin post a notice with a title (1 to 60 characters), a message (1 to 200 characters) and an optional "show through" date, and remove a notice. No more than 3 notices SHALL be active at once. Notices SHALL be plain text and SHALL NOT be editable. A player or signed-out visitor SHALL be refused every notice write and the admin list.

#### Scenario: Posting
- **WHEN** an admin posts "Live music Saturday" with a message and no date
- **THEN** the notice is active until it is removed

#### Scenario: A date in the past
- **WHEN** an admin posts a notice whose show-through date has already gone
- **THEN** the post is refused with a clear message

#### Scenario: A fourth notice
- **WHEN** three notices are active and an admin posts another
- **THEN** it is refused with a message saying to remove one first

#### Scenario: Not an admin
- **WHEN** a player calls a notice write route
- **THEN** it is refused (403) and nothing changes

### Requirement: When a notice is active
A notice SHALL be active from the moment it is posted until the end of its show-through date in Eastern time, or until it is removed when it has no date. The newest SHALL show first.

#### Scenario: The last day
- **WHEN** a notice's show-through date is today
- **THEN** it still shows today and is gone tomorrow

### Requirement: The banner
The system SHALL show every active notice, with its title and message, at the top of every signed-in player page, above the page's own content (on Home, above the pool section), and SHALL NOT show it on admin pages, the public menu or the TV. The banner SHALL be announced to screen readers, fit a phone 390 wide, show plain text only, and take no space when there is nothing to show.

#### Scenario: Seeing it
- **WHEN** a signed-in player opens Home or Standings while a notice is active
- **THEN** the notice shows at the top

#### Scenario: No notices
- **WHEN** no notice is active
- **THEN** nothing is shown and no gap is left

#### Scenario: Admin pages
- **WHEN** an admin opens an admin page
- **THEN** no banner shows there

### Requirement: Closing a notice
Each notice SHALL have a labelled close button. Closing it SHALL hide that notice on that device, and it SHALL stay hidden after the page is reloaded and across later visits, until it is removed. A newly posted notice SHALL always show, even on a device where earlier notices were closed. The server SHALL NOT record who closed which notice.

#### Scenario: Closing and reloading
- **WHEN** a player closes a notice and reloads
- **THEN** it stays closed, while any other active notice still shows

#### Scenario: A new notice
- **WHEN** an admin posts a new notice after a player closed the earlier one
- **THEN** the player sees the new notice and not the earlier one

### Requirement: Notices stay out of From the brewery
Notices SHALL NOT appear in From the brewery on Home, in its admin list, or in "Live this weekend".

#### Scenario: Both exist
- **WHEN** a notice and an announcement are active
- **THEN** the notice shows only in the banner and the announcement only in From the brewery
