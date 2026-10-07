# operator-access Specification

## Purpose
The site's god-user: an account whose verified email is in OPERATOR_EMAILS passes every admin check and alone gets the site-setup screens, while the pool's fairness rules still bind it.

## Requirements

### Requirement: The god-user
An account SHALL be the god-user when its verified email address is in the server setting `OPERATOR_EMAILS`. The god-user SHALL pass every admin check without needing the admin flag, and SHALL be the only account that can use the site-setup routes and screens. The status SHALL NOT be stored in the database and SHALL NOT be grantable or removable from inside the app. An unverified email SHALL NOT qualify.

#### Scenario: God-user is not flagged admin
- **WHEN** the god-user's account has no admin flag and they call an admin route
- **THEN** it is allowed

#### Scenario: Ordinary admin
- **WHEN** an admin who is not the god-user calls a site-setup route
- **THEN** the request is refused (403)

#### Scenario: Not signed in or a player
- **WHEN** a signed-out visitor or a player calls a site-setup route
- **THEN** it is refused (401 or 403)

### Requirement: Fairness rules hold for the god-user
The god-user SHALL NOT see any other player's pick before its reveal time (an admin-level view shows only that a pick exists), SHALL NOT be able to change another player's pick, SHALL NOT override a lock, and SHALL still need another admin's confirmation for a decision that changes the god-user's own entry (with today's recorded fallback when they are the only admin).

#### Scenario: Early look at picks
- **WHEN** the god-user asks for another player's pick before its game has started
- **THEN** they see only that a pick exists

#### Scenario: Changing someone's pick
- **WHEN** the god-user tries to change another player's pick
- **THEN** the request is refused

### Requirement: Setup screens only for the god-user
The More screen SHALL list Schedule, Admins and Help someone sign in only for the god-user. Other admins SHALL NOT see them, and opening their addresses SHALL send them away.

#### Scenario: Lark opens More
- **WHEN** an admin who is not the god-user opens More
- **THEN** the setup screens are not listed
