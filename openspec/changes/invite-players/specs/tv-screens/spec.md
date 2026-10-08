## ADDED Requirements

### Requirement: A Standings slide invites people to join its pool
On a TV screen, while a Standings slide shows and its pool is open to new players, the "Play on your phone" strip SHALL point its QR code at that pool's join page and say "Scan to join <pool name>". When the pool is not open to new players the strip SHALL keep pointing at the home address. Drinks and Kitchen slides SHALL keep pointing at the menu, and Music and Calendar slides at the home address. The public TV feed SHALL carry, for a Standings slide, only the join path (or nothing), never anything private. The signed-in pool TV page SHALL be unchanged.

#### Scenario: Standings slide for an open pool
- **WHEN** a TV shows the Standings slide for an open pool
- **THEN** the strip's QR code opens that pool's join page and the strip says to scan to join it

#### Scenario: A finished pool
- **WHEN** a TV shows the Standings slide for a finished pool
- **THEN** the strip points at the home address

#### Scenario: Other slides
- **WHEN** the Drinks, Music or Calendar slide shows
- **THEN** the strip points where it did before
