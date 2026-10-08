## Purpose

Lets any player bring others into a pool with a share link, and makes sure a person who arrives by a shared link or a TV code lands where they were going and can join and pick without a hitch.

## ADDED Requirements

### Requirement: Sign-in returns to where the person was going
When a person signs in with the emailed link, the system SHALL return them to the page they had opened, not always to Home, provided it is a page inside the app. An address that is not a page inside the app (another site, a protocol, a double slash, backslashes, or anything not starting with a single "/") SHALL never be used as the destination, and Home SHALL be used instead. Signing in with a password SHALL still show the page that was opened.

#### Scenario: A shared join link
- **WHEN** a signed-out person opens `/join/<pool>`, asks for the email link and opens it
- **THEN** they land on that pool's join page

#### Scenario: Ordinary sign-in
- **WHEN** a signed-out person opens the home address and signs in
- **THEN** they land on Home, as before

#### Scenario: A dangerous destination
- **WHEN** the address the person opened is not a page inside the app
- **THEN** after signing in they land on Home

### Requirement: Any player can invite a friend
The system SHALL show every signed-in player an "Invite a friend" button for each pool they are in that is open to new players (not finished), on Home and on that pool's Standings. Tapping it SHALL share a link to that pool's join page with a short message naming the pool, using the phone's share sheet when it has one and otherwise copying the link and saying "Link copied". The link SHALL be the same for every player and SHALL contain no email address, name or other private detail. No invite SHALL be recorded.

#### Scenario: Sharing
- **WHEN** a player in "Sunday Survivor" taps Invite a friend
- **THEN** a link to Sunday Survivor's join page is shared or copied, with no personal details in it

#### Scenario: Copying
- **WHEN** the phone has no share sheet
- **THEN** the link is copied and the button says "Link copied"

#### Scenario: A finished pool
- **WHEN** a pool has finished
- **THEN** it shows no Invite a friend button

#### Scenario: Not in the pool
- **WHEN** a player is not in a pool
- **THEN** there is no invite button for it

### Requirement: The first-time journey works end to end
A person with no account SHALL be able to open a shared pool link on a phone, sign in with the emailed link, land on the pool's join page, set a display name if they have none, join, make a pick, and see it saved. This SHALL also work for a pool that started late, where the earlier weeks had no picks and count as a free pass for everyone.

#### Scenario: A brand-new player
- **WHEN** a new person follows a shared pool link, signs in, gives a name, joins and picks a team
- **THEN** their pick is saved and they appear in the pool under that name, not their email

#### Scenario: A late joiner
- **WHEN** the pool's earlier weeks were a free pass and a new person joins this week
- **THEN** they can pick for the current week and the earlier weeks show as a free pass for everyone
