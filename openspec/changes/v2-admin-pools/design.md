## Context

Pools are managed on `AdminDashboard.tsx` (887 lines): tabs Pools, Games, Entries, Picks, a settings popup, a create popup, and a wipeout banner. Slice 9a moved it unchanged to `/admin/pools` and `/admin/pools/:poolId` inside the new admin layout. The APIs this slice needs mostly exist: `GET /pools`, `GET /pools/:id`, `PATCH /pools/:id` (name, season, status, rules, total), `DELETE /pools/:id` (name confirm), `GET /pools/:id/entries` (admin sees emails), `POST /pools/:id/entries`, `PATCH /entries/:id` (unvalidated body), `GET /pools/:id/picks` (viewer-filtered: other players' teams are hidden before the lock). Every admin write already records an activity entry. See proposal.md for the why and the choices Robin made.

## Goals / Non-Goals

**Goals:**
- Close the "cannot restore a player" gap and rebuild every pool screen for a phone.
- Make the rules lock real on the server.
- Keep activity recording and the coverage test intact.

**Non-Goals:**
- "Another admin confirms" (slice 10), Pick 'em picks view, announcements, menu, table card, guide, any schema change.

## Decisions

- **Server refuses rule changes on a locked pool.** In `PATCH /pools/:id`, a change to name, season or rules is refused (409, "The rules are locked. Unlock the pool to change them.") when the pool is not a draft, unless the same request sets status to draft. Values equal to the current ones are not changes, so a harmless re-save passes. The pool total and the status itself are always allowed. Alternative: leave it on the screen. Rejected (Robin's call): an old tab or a tool could silently change the rules mid-season.
- **Status edit validated by a shared schema.** `updateEntrySchema`: `status` in the entry statuses, `eliminatedWeek` an integer 1 to 25 or null. The route applies: Alive clears the week; Out needs a week (from the body, or the existing one). Unknown fields are rejected by the schema, so nothing but these two fields can be written.
- **Add a player asks for a name only when needed.** `createEntrySchema.display_name` becomes optional. When the email has an account the entry links to it; when it has none and no name was sent, the route answers 422 with a code `NAME_REQUIRED`, and the form then reveals "Their name" and resubmits. Alternative: a separate lookup endpoint. Rejected: another route that tells an admin whether an email has an account, for no gain.
- **The roster gets two flags from the server.** For admins, `GET /pools/:id/entries` adds `invited` (no account yet) and `isYou` (the viewing admin's entry). They are only added on the admin path (where emails already appear), so players learn nothing new.
- **Picks view uses the existing picks route.** It already hides other players' teams before the lock and shows the admin their own. The screen takes the week from a picker (`/nfl/weeks?year=`), the current week by default (`/admin/summary`), and counts Alive, No pick, Lost or Picked from the entries and picks it already has. No new endpoint. Pick 'em has no Picks tab (Robin's call).
- **Settings reuse the existing form logic** (the rules inputs and the total form) in a screen-sized layout, with an explicit Lock or Unlock button that sets the status; "locked" means the pool is not a draft, as today.
- **Wizard creates, then locks.** "Open the pool" is `POST /pools` followed by `PATCH` status active. If the second call fails the pool exists unlocked, and the screen says so and offers to try again (no half-hidden pool). "Change a rule" creates the pool as a draft and opens its settings. Season defaults to the latest in `/nfl/seasons`, with a select on the review step.
- **Remove the old dashboard** (`AdminDashboard.tsx`, `AdminPoolsPanel.tsx`, `AdminPanelContext.tsx`) and the page-title hack in `Shell`/`nav.ts` that only served it.
- **Routes:** `/admin/pools` (list), `/admin/pools/new` (focus layout), `/admin/pools/:poolId` (with `?tab=players|picks|settings`; default Players). The tab is a query parameter so each opens by link and survives a reload.

## Risks / Trade-offs

- [Restoring a player changes standings] → server validation, an Activity record per edit (already in place), and the inline note when it is the admin's own entry.
- [The lock refusal breaks an existing flow] → only changes to values are refused; tests cover locked, unlocked, unlock-and-edit and no-op saves; the existing pool-total and activity tests still pass.
- [A pool is created but locking fails] → the wizard reports it and offers to retry; the pool is visible and editable in the list.
- [Large roster on a phone] → short list with "Show all", search over everyone; names and emails truncate.
- [Admin edits their own entry before slice 10] → allowed and flagged, as slice 8 specified.

## Migration Plan

No data change. Push to `staging`, check the changed endpoints' answers there (signed out 401), walk every screen locally in real Chrome (the staging preview cannot reach the staging API), promote. Rollback is a revert.
