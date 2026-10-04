# from-the-brewery Specification

## Purpose
What is happening at the brewery, shown to players on Home and posted by admins: a featured menu item, specials, and a weekly announcement.

## Requirements

### Requirement: Three kinds of posts
The system SHALL support a featured menu item, a special and an announcement, each posted by an admin and shown to players on Home while it applies.

#### Scenario: Existing announcements
- **WHEN** the system starts with announcements posted before this change
- **THEN** they remain valid announcements and show only during their week

### Requirement: Announcements
The system SHALL let an admin post an announcement with a title (1 to 60 characters), a message (1 to 300 characters) and a week of the current season, no earlier than the current week. It SHALL show on Home only during that week and then stop on its own. When no announcement applies, Home SHALL show the standard "Watch with us" message.

#### Scenario: This week
- **WHEN** an admin posts an announcement for the current week
- **THEN** players see its title and message on Home

#### Scenario: Next week
- **WHEN** an announcement is posted for next week
- **THEN** it is not shown until that week

#### Scenario: None this week
- **WHEN** no announcement applies
- **THEN** Home shows the standard "Watch with us" message

### Requirement: Featured item
The system SHALL let an admin feature one menu item, for this week or until changed. Featuring a new item SHALL replace the previous one. Home SHALL show the featured item with its name and style and strength, and SHALL leave it out when the item is switched off or removed.

#### Scenario: Replace
- **WHEN** an admin features a different item
- **THEN** only the new one is featured

#### Scenario: Item runs out
- **WHEN** the featured beer is switched off
- **THEN** Home no longer shows it

#### Scenario: Item removed
- **WHEN** the featured item is removed from the menu
- **THEN** the feature is gone

### Requirement: Specials
The system SHALL let an admin post a special with a title (1 to 80 characters), optional details (up to 200), an optional tag (kitchen special, game-day special, family night), and either chosen days of the week with optional from and until times, or one date. A special SHALL show on Home all day on its days, with its times in the text, and a past one-day special SHALL not show. The system SHALL refuse a special with no day and no date, with both, with an end time but no start, or with an end not after the start.

#### Scenario: Every Sunday
- **WHEN** a special is posted for Sundays, 1 to 4 PM
- **THEN** it shows on Home on Sundays as "Sundays, 1 – 4 PM" and not on other days

#### Scenario: One day only
- **WHEN** a special is posted for a single date
- **THEN** it shows on that date only

### Requirement: Home shows the brewery section
The system SHALL return the featured item, today's specials and the announcement in the single Home request, and Home SHALL show them under "At the brewery" in that order, leaving out any that do not apply. The section SHALL not appear on the first-run welcome. Home SHALL keep "Please drink responsibly." at the bottom.

#### Scenario: Everything posted
- **WHEN** a feature, a special for today and an announcement exist
- **THEN** Home shows the three in that order

#### Scenario: Nothing posted
- **WHEN** nothing is posted
- **THEN** Home shows the standard "Watch with us" message only

### Requirement: Only admins post
The system SHALL let only admins see what is showing, post and remove, answering 401 when signed out and 403 for players, and SHALL record each post and removal in Activity with who made it, never held for another admin's confirmation.

#### Scenario: A player tries
- **WHEN** a signed-in player tries to post
- **THEN** it is refused with 403 and nothing changes

### Requirement: From the brewery screens
The system SHALL give admins a From the brewery screen with rows to feature a drink or dish, add a special, add live music and write an announcement, and a "Showing now" list where each item can be removed after confirming. The feature wizard SHALL have two steps (pick from the menu with search, how long), the special wizard three (what, when, review) and the announcement wizard three (what, message with preview, which week). The special wizard SHALL tell the admin to describe the food or drink and not link it to winning, losing or picks. All SHALL fit a 390 pixel wide screen.

#### Scenario: Post a special
- **WHEN** an admin completes the special wizard
- **THEN** it appears in Showing now and on Home on its days

#### Scenario: Remove
- **WHEN** an admin removes an item after confirming
- **THEN** it is gone from Showing now and from Home

### Requirement: Automatic offers are retired
The system SHALL no longer show the four automatic offers on any screen, and SHALL no longer offer the interim Promotions page.

#### Scenario: Old address
- **WHEN** an admin opens the old Promotions address
- **THEN** they are taken to From the brewery
