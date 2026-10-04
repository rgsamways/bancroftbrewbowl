# admin-confirmations Specification

## Purpose
A decision that changes an admin's own standing needs another admin's confirmation before it takes effect.

## Requirements

### Requirement: Own-standing decisions become requests
When an admin keeps their own entry alive in a wipeout, or changes the status of their own entry, and at least one other admin exists, the system SHALL NOT apply the change. It SHALL store a pending request and tell the admin to ask another admin.

#### Scenario: Keeping yourself alive
- **WHEN** an admin resolves a wipeout with their own entry among those kept
- **THEN** nothing changes, a pending request is stored, and the response says it needs confirmation

#### Scenario: Eliminating yourself
- **WHEN** an admin resolves a wipeout without keeping their own entry
- **THEN** it applies at once

#### Scenario: Editing your own status
- **WHEN** an admin changes the status of their own entry
- **THEN** a pending request is stored and the entry is unchanged

#### Scenario: Only admin
- **WHEN** the acting admin is the only admin
- **THEN** the decision applies at once and is recorded and flagged as affecting their own entry

### Requirement: Another admin confirms or declines
The system SHALL let any admin other than the requester confirm or decline a pending request, and SHALL refuse the requester and non-admins.

#### Scenario: Confirm
- **WHEN** another admin confirms
- **THEN** the decision is applied, the request is marked confirmed, and the confirmation is recorded

#### Scenario: Decline with a reason
- **WHEN** another admin declines with an optional reason
- **THEN** nothing is applied and the request is marked declined with the reason

#### Scenario: Own request
- **WHEN** the requester tries to confirm or decline their own request
- **THEN** the server refuses

#### Scenario: Stale request
- **WHEN** the wipeout was resolved or the entry changed since the request was made
- **THEN** confirming applies nothing and the request is marked cancelled

### Requirement: Requests are in Activity
Asking, confirming and declining SHALL each be recorded with the acting admin's name and flagged when about that admin's own entry.

#### Scenario: Both steps recorded
- **WHEN** a request is made and then confirmed
- **THEN** Activity shows two records, one per admin

### Requirement: Next step shows requests
Other admins SHALL see "Confirm a decision from <name>" as their Next step while a request is pending. The requester SHALL see a declined request with its reason as "Needs another look" until they act again or dismiss it, and SHALL see a waiting line while one is pending.

#### Scenario: Confirm card
- **WHEN** a request is pending and the viewer is another admin
- **THEN** Next step is the confirm card, ahead of results

#### Scenario: Declined card
- **WHEN** the requester's request was declined
- **THEN** their Next step shows the reason and a way to choose again

### Requirement: Screens
The wipeout and status screens SHALL say when a choice needs confirmation and offer "Ask another admin to confirm". The confirm screen SHALL show what was chosen, the result, and Confirm and Don't confirm. Declining SHALL offer quick reasons and an optional note. Sent, confirmed and declined end screens SHALL say plainly what happened. All SHALL fit a phone at 390 wide.

#### Scenario: Sent
- **WHEN** a request is sent
- **THEN** the screen names the admins asked and says nothing changes until one confirms
