## Why

The rules say a decision that changes an admin's own standing needs another admin to confirm it (rule 10 in `docs/ROLES_AND_RULES.md`). Today an admin who also plays can keep themselves alive in a wipeout, or edit their own status, with nobody checking. Activity only flags it afterwards.

## What Changes

- A new table `admin_requests` holds a decision waiting for another admin.
- Keeping yourself alive in a wipeout, or changing your own status, no longer applies at once. It becomes a request: nothing changes until another admin confirms.
- Another admin sees "Confirm a decision from <name>" as their Next step, reviews what was chosen, and confirms or declines with an optional reason. Confirming applies the decision.
- The person who asked sees a declined request (with the reason) as "Needs another look" and can choose again.
- With only one admin, the decision goes through at once, recorded and flagged (as today).
- Asking, confirming and declining all appear in Activity.
- The server enforces all of this; the screens only follow it.

## Capabilities

### New Capabilities
- `admin-confirmations`: requests for a second admin's confirmation, the confirm and decline screens, and the Next step cards for them.

### Modified Capabilities
<!-- None: the Next step and wipeout screens gain behavior, described in the new capability's spec. -->

## Impact

- Schema: one new table `admin_requests` (migration 0007, additive).
- API: new `routes/admin-requests.ts`; `POST /pools/:id/wipeouts/:id/resolve` and `PATCH /entries/:id` return a request instead of applying when the rule triggers; `GET /admin/summary` gains pending and declined requests.
- Shared: new activity kinds, request types.
- Dashboard: confirm screen, decline screen, sent screen, two new Next step cards, "Ask another admin to confirm" on the wipeout and status screens.
- Tests: API tests (real Postgres) and an `e2e/` spec.
