## Context

Activity already flags changes to an admin's own entry (`affectsOwnEntry`). Two routes make such changes: wipeout resolve (`routes/wipeouts.ts`) and the entry status edit (`PATCH /entries/:id`). Mockups: `admin-wipeout-self`, `admin-approval*`, `admin-next-approval`, `admin-next-declined`.

## Decisions

- **What triggers a request.** (1) A wipeout resolution where the acting admin's own entry is among the survivors. (2) Any status change to the acting admin's own entry. Eliminating yourself in a wipeout, results, menu, music and announcements never need one (matches the rules doc).
- **Fallback.** If the acting admin is the only admin (count of `isAdmin` users is 1), apply at once and record as today, flagged.
- **Table `admin_requests`:** `id`, `kind` (`wipeout_resolution` | `status_change`), `pool_id`, `requested_by` (user, set null on delete) and `requested_by_name`, `wipeout_id` nullable, `entry_id` nullable, `payload` jsonb (survivor entry ids, or new status and week), `status` (`pending` | `confirmed` | `declined` | `cancelled`), `decided_by`, `decided_by_name`, `decided_at`, `decline_reason`, `seen_at` (requester has acknowledged a decline), `created_at`. Text for `kind` and `status` like `admin_activity`, validated in `@bbb/shared`. Additive only.
- **Applying.** Confirm runs the same code as the direct route (extracted into shared functions the routes and the confirm call), in one transaction with the request update and the activity record. It re-checks that the wipeout is still unresolved and the entry unchanged; otherwise the request becomes `cancelled` and the confirmer is told.
- **Who may confirm.** Any admin except the requester, checked on the server. Declining is the same.
- **While pending.** The wipeout stays unresolved. A second request for the same wipeout or entry replaces the first (old one `cancelled`). Another admin may still resolve the wipeout directly if their own entry is not among the survivors; that cancels the pending request.
- **Declined.** Shown to the requester on Next step until they send a new request, resolve it, or tap "Got it" (sets `seen_at`).
- **Next step order.** Confirm a decision (for other admins) first, then declined request (for the requester), then the existing order. A requester with a pending request sees a quiet "Waiting for <names>" line and the existing steps after it; the wipeout step is not shown again to them.
- **Activity.** New kinds `confirmation_requested`, `confirmation_confirmed`, `confirmation_declined`, all `affectsOwnEntry` when about the actor's entry. The existing coverage test must pass, so every new write route records.
- **Routes.** `GET /admin/requests/:id` (admin; the details to review), `POST /admin/requests/:id/confirm`, `POST /admin/requests/:id/decline` (`reason` optional, max 200), `POST /admin/requests/:id/seen`. The two existing routes answer 202 with `{ request }` when they create a request.
- **Privacy.** Request details show names and chosen survivors only; no emails, no picks beyond what a locked week already shows.

## Risks

- A bad migration blocks the deploy, so run it on staging's own database first and check IDs differ from production.
- Two admins acting at once: the confirm transaction locks the request row and re-checks status.
- Data left behind: tests clean up their own requests and activity.
