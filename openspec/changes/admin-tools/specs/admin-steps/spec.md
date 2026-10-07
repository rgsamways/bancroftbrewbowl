## ADDED Requirements

### Requirement: More lists the setup screens for the god-user
More SHALL list Schedule, Admins and Help someone sign in for the god-user only, under a "Site setup" heading, and the Admin tab SHALL show for the god-user even when the account is not flagged as an admin.

#### Scenario: God-user
- **WHEN** the god-user opens More
- **THEN** the three setup screens are listed

#### Scenario: Another admin
- **WHEN** another admin opens More
- **THEN** the setup screens are not listed
