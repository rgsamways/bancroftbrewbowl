## Why

Admins change things that decide who is alive and what a pool looks like: results, player status, wipeout decisions, locking a pool. Today nothing records who did what or when. With three admins expected (the owner's wife, Robin and the owner), and one of them also playing, "who changed that?" will come up, and the "another admin confirms" rule (slice 10) needs a record to write into. The v2 plan puts the record in before the admin actions are rebuilt (slice 9) so they can write to it from day one. This is slice 8 of the v2 build (`docs/v2/V2_BUILD_PLAN.md`, `docs/ROLES_AND_RULES.md` "The record of admin changes").

## What Changes

- A new **`admin_activity` table**: who (the signed-in admin, by id and by name at the time), what kind of change, a plain-English sentence, the pool it concerned, whether it touched the admin's own entry, and when. **Additive only; nothing existing changes.**
- Every existing admin route that changes standings or content **writes a row**, naming the signed-in admin explicitly from the route code (no database trigger, which is what left kerfy's log without a name): entering or changing a result and score, resolving a wipeout, editing a player's status, adding a player, creating, locking, unlocking, editing and deleting a pool, changing the pool total, and creating, editing or deleting an announcement or the automatic offers.
- A new **Activity page** for admins: a newest-first list with day and time in Eastern time, a short title, the sentence, and an "Affects <name>'s entry" / "Your own entry" mark, filtered by Everything, Standings, Your own entry and Menu, loading earlier entries on request. Players cannot see it.
- The record **cannot be edited or deleted** through the app: there is no route to do so, and a test proves it.
- The record **lists the kinds of change it knows about in one place** so the menu and music (slice 11) and confirmations (slice 10) add theirs by adding to that list, not by changing the table.
- Out of scope: the "another admin confirms" flow (slice 10), menu and music events (no menu yet, slice 11), changing admin access (there is no screen for it; it is an operator script), the step-by-step admin screens (slice 9), and exporting the log.

## Capabilities

### New Capabilities
- `admin-activity`: what is recorded when an admin changes something, what each record holds, who can read it, that it cannot be changed, and the Activity page.

### Modified Capabilities
<!-- None. The existing admin routes keep their behaviour; they only gain a record of what they did. -->

## Impact

- **Database:** one new table `admin_activity` (migration). **Schema-changing push:** the migration runs automatically in Railway's `preDeploy`, so it is called out before pushing and run on staging's separate database first. Rollback is a revert of the commit; the unused table is harmless.
- **API** (`apps/api`): `src/db/schema.ts`, new `src/lib/activity.ts` (one `recordActivity` helper and the before/after check for the admin's own entries), new `GET /admin/activity`, and a record call added to the admin routes in `nfl.ts`, `wipeouts.ts`, `entries.ts`, `pools.ts`, `promotions.ts`, `canned-promotions.ts`.
- **Shared** (`packages/shared`): the list of activity kinds with their title and category, the response type, and an Eastern "Today · 5:04 PM" time formatter.
- **Dashboard** (`apps/dashboard`): new `ActivityPage.tsx`, a link in the interim admin sub-navigation.
- **Tests:** API tests per recorded action (who, what, pool, own-entry flag), the read route's permissions and filters, and immutability; a browser check of the Activity page.
- **Design:** `admin-activity.html` in `docs/v2/mockups/`.
- **Risk:** a missed route would leave a silent gap, so a test lists every admin write route and fails if one has no record. A failed write of the record returns an error instead of being swallowed.
