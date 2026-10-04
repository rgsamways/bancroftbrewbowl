## Context

Admin writes live in several route files (`nfl.ts`, `wipeouts.ts`, `entries.ts`, `pools.ts`, `promotions.ts`, `canned-promotions.ts`), each guarded by `requireAdmin`, which returns the session (so the route already knows who is acting). `scoreGame` runs one transaction per pool; wipeout resolution and a few others use their own transaction. There is no audit trail today. `docs/ROLES_AND_RULES.md` ("The record of admin changes") specifies a plain table written by route code. This is a schema change, so it gets the design pass here and a call-out before the push. See proposal.md for why.

## Goals / Non-Goals

**Goals:**
- Every admin write leaves a durable, readable, unchangeable record that names the actor.
- Adding the menu (slice 11) and confirmations (slice 10) later needs no schema change.

**Non-Goals:**
- Letting admins undo from the log, exporting it, retention rules, or recording player actions.

## Decisions

- **One table, `admin_activity`.** Columns: `id` uuid, `actor_id` text null (references `user`, on delete set null), `actor_name` text not null (name at the time), `kind` text not null, `summary` text not null (the sentence, rendered at write time), `pool_id` uuid null (references `pools`, on delete set null), `affects_own_entry` boolean not null default false, `created_at` timestamptz default now, with an index on `created_at desc`. Alternatives: store structured details and render on read (rejected: a rename or delete would rewrite history, and the sentence is what a person needs); keep the actor only as an id (rejected: deleting an account would erase who did it).
- **`kind` is text, not a database enum, validated against a list in `@bbb/shared`.** The list maps each kind to a title ("Entered a result") and a category (standings, pool, content, menu). Adding a kind (menu, music, confirmations) is a code change with no migration. Alternative: a Postgres enum (rejected: every new kind would need a migration, which is the friction `docs/ROLES_AND_RULES.md` already avoided for rules).
- **Categories for the filters** come from the kind list, not the table: Standings = results, scores, wipeouts, player status, players added; Pool = creating, locking, settings, total, deleting (shown under Everything and Standings, since they change who plays or the rules); Content = announcements and automatic offers (Everything only); Menu = reserved for slice 11. "Your own entry" filters on the flag and the viewing admin's id.
- **One helper, `recordActivity(executor, {...})`,** takes the signed-in admin's session user explicitly, so no route can forget the actor. It runs inside the caller's transaction when the route already has one (wipeout resolution, pool and entry changes), and straight after the change otherwise (results, because scoring runs its own per-pool transactions). It is awaited, so a failure surfaces as an error rather than a silent gap; the error text says the change was saved but could not be recorded.
- **"Affects own entry" is computed exactly, not guessed.** Before a change that can alter standings (result entry, wipeout resolution, pool deletion), snapshot the status of the acting admin's own entries; after it, compare. A direct change to an entry is flagged when that entry belongs to the actor. Adding a player is flagged when the added person is the actor.
- **Reading.** `GET /admin/activity?filter=&before=` is admin only, newest first, 50 per page, with the next cursor being the `created_at` of the last row. No update or delete routes exist, and a test requests `PATCH` and `DELETE` on a record and expects "not found". The table is also never touched by `UPDATE`/`DELETE` statements in code (a test greps for it).
- **Coverage test.** A test reads the registered Fastify routes, takes the ones that are not `GET` and sit behind `requireAdmin`, and requires each to appear in a list of routes that were exercised to write a record (or in a short allow-list with a reason, such as nothing today). Adding an admin write route without a record then fails the suite.
- **Activity page** is added to the interim admin sub-navigation now and moves under "More" when the step-by-step admin lands (slice 9). Times use the shared Eastern helpers.

## Risks / Trade-offs

- [Schema change runs unattended on deploy] → additive new table, verified locally and on staging's own database first, called out before the push; revert needs no rollback.
- [A route is missed] → the coverage test; plus a record test per action.
- [Result scoring succeeds but the record fails] → the request returns an error that says exactly that, and the result stays saved; an admin can see it did apply. Wrapping scoring in one transaction was considered and rejected as a much larger change to `scoreGame`.
- [Sentences drift from the data] → they are written once from the same values the route just used.
- [Log grows] → tens of rows a week; no retention rule needed. Revisit if it ever matters.

## Migration Plan

1. `pnpm db:generate` for the new table; check the migration is one CREATE TABLE plus its index and two foreign keys.
2. Apply locally, then push to `staging` and confirm on `api-staging`'s own database that the table exists and an admin write creates a row.
3. Promote to `main`; Railway's `preDeploy` migrates production. Confirm the table exists in production.
4. Rollback: revert the commit.
