# menu-items Specification

## Purpose
A menu of drinks and dishes that anyone can read, kept current by admins.

## Requirements

### Requirement: The menu is public
The system SHALL provide `GET /public/menu`, answering without a session, with every menu item grouped by kind and section, each with its name, style, strength, description, price (when set), add-ons, labels and whether it is available. It SHALL return no information about users or admins.

#### Scenario: Signed out
- **WHEN** a request with no session asks for the public menu
- **THEN** it receives the items and no sign-in is required

#### Scenario: Nothing private
- **WHEN** the public menu is returned
- **THEN** it contains no email addresses, user ids or admin fields

#### Scenario: Empty menu
- **WHEN** no items have been added
- **THEN** the response is an empty menu and the page says the menu is not set up yet

### Requirement: Menu pages
The system SHALL show the menu at `/menu` (Drinks, with On tap, Wine and Other drinks) and `/menu/kitchen` (dishes by section, add-ons and side choices) to signed-out visitors and signed-in players. Items that are not available SHALL still appear, marked as out. Prices SHALL appear only when set. Every menu page SHALL end with "Please drink responsibly." A signed-out visitor SHALL also see a "Play Brew Bowl" banner with a Sign in button and no tab bar.

#### Scenario: Visitor from a QR code
- **WHEN** a signed-out person opens `/menu`
- **THEN** they see the drinks, the sign-in banner and no tab bar, and are not sent to the sign-in page

#### Scenario: A player
- **WHEN** a signed-in player opens the Menu tab
- **THEN** they see the same menu inside the app with the Menu tab marked

#### Scenario: Out of stock
- **WHEN** an admin switches a beer off
- **THEN** the next time the page loads it shows that beer marked out

#### Scenario: No price
- **WHEN** an item has no price
- **THEN** no price or placeholder is shown for it

### Requirement: Only admins change the menu
The system SHALL let only admins add, edit, switch on or off, and remove menu items, answering 401 when signed out and 403 for players, and SHALL record each change in Activity with who made it.

#### Scenario: A player tries
- **WHEN** a signed-in player sends a menu change
- **THEN** it is refused with 403 and nothing changes

#### Scenario: Recorded
- **WHEN** an admin adds, changes, removes or switches an item
- **THEN** Activity shows one record naming the admin and the item, never held for another admin's confirmation

### Requirement: Menu items are validated
The system SHALL refuse an item with no name, a name over 80 characters, an unknown kind or label, a negative or fractional price, more than 12 add-ons, or a kitchen dish with no section, and SHALL accept an item with only a name, kind and section.

#### Scenario: Minimal item
- **WHEN** an admin adds a beer with only a name
- **THEN** it is saved with no style, strength, price or description

#### Scenario: Bad price
- **WHEN** an admin sends a negative price
- **THEN** the server refuses it

### Requirement: Admin Menu screens
The system SHALL give admins a Menu screen with Drinks and Kitchen lists, a switch on each item to mark it available or out, a four-step wizard to add an item (what it is; name and style; strength, price and labels; review), an edit screen, and a Remove that asks first and says it is permanent. The wizard SHALL end with a screen that says the item is on the menu and offers "Back to the menu" and "Add another". All SHALL fit a 390 pixel wide screen.

#### Scenario: Add a beer
- **WHEN** an admin completes the wizard for a beer
- **THEN** it appears in the list and on the public menu straight away

#### Scenario: Switch off
- **WHEN** an admin turns an item's switch off
- **THEN** the list shows it as Out and the public menu does too

#### Scenario: Remove
- **WHEN** an admin removes an item after confirming
- **THEN** it is gone from the list and the public menu
