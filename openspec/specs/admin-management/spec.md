# admin-management Specification

## Purpose
Listing, adding and removing admins from a screen, with last-admin and site-owner protection and a record in Activity.

## Requirements

### Requirement: Manage admins from a screen
The god-user SHALL see on the Admins screen everyone with admin access, and SHALL be able to add an admin by email and remove one. Adding SHALL require an existing account for that email, and otherwise say the person needs to sign in once first. The last admin SHALL NOT be removable, and an account that is the god-user SHALL NOT be removable from the list. Each change SHALL be recorded in Activity under the god-user's name.

#### Scenario: Add Lark
- **WHEN** the god-user adds an email that has an account
- **THEN** that account becomes an admin and appears in the list

#### Scenario: No account yet
- **WHEN** the email has no account
- **THEN** the screen says they need to sign in once first and nothing changes

#### Scenario: Last admin
- **WHEN** the god-user tries to remove the only admin
- **THEN** it is refused with a plain message
