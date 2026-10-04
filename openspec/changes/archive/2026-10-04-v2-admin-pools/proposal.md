## Why

Slice 9a gave the brewery staff a phone-first way to do the weekly job (results and wipeouts), but the **Pools** tab still opens the old desktop-style dashboard: four tabs, a settings popup, a wide picks table, and nowhere to edit a player's status or add a player, which means a player a corrected result wrongly knocked out cannot be put back from the app. This slice rebuilds the pool screens the way the v2 mockups show them and closes that gap. It is the second half of slice 9 (`docs/v2/V2_BUILD_PLAN.md`).

## What Changes

- **Pools list** (`/admin/pools`): each pool with its kind, season, player count and status (Unlocked, Locked, Finished), and a **New pool** button.
- **Pool screen** (`/admin/pools/:poolId`) with sub-tabs **Players | Picks | Settings** (Picks only for Survivor pools):
  - **Players:** a searchable roster (avatar, name, email, Alive or "Out wk N"), "Show all N", **Add a player**, and tapping a row opens an inline editor to set **Alive or Out** and the **week they went out**. Editing your own entry is allowed and clearly marked ("recorded in Activity and marked as your own entry"; the "another admin confirms" step is slice 10). A banner links to a waiting wipeout decision for the pool.
  - **Picks (Survivor):** one week at a time with a week picker. Before the lock, teams are hidden for everyone but the admin's own row ("Team hidden until the lock") and the screen shows who has and has not picked; after the lock everyone's picks show with Won, Lost or Waiting. Filter chips Alive, No pick, Lost or Picked.
  - **Settings:** name, season, rules (tie handling, same team twice, extra lives, double-pick weeks), a clear **Lock or Unlock the rules** control, the pool total form, and **Delete pool** with the type-the-name confirmation. The rules are read-only while locked.
- **New pool wizard** (`/admin/pools/new`, four steps): name, how will people play (Survivor or Pick 'em), check the rules, ready to open. "Open the pool" creates it and locks the rules, then shows the join link. "Change a rule" creates it unlocked and opens its settings.
- **Server:** changing a pool's **name, season or rules is refused while the pool is locked** (the pool total and unlocking still work); a player's status edit is **validated** (status, elimination week); adding a player with no account yet asks for a name only when needed (the form asks for the email first); the roster tells an admin which entries are **invited** (no account yet) and which is **their own**.
- **Removed:** the old four-tab pool dashboard, its settings popup and the create-pool popup.
- Out of scope: the "another admin confirms" flow (slice 10), the pool picks table for Pick 'Em (hidden), announcements, menu, the table card and admin guide (slice 13), and any database change.

## Capabilities

### New Capabilities
- `admin-pools`: the pools list, the pool screen (players, picks, settings, delete), and the new-pool wizard, including the server rules that go with them (locked rules, status-edit validation, adding a player).

### Modified Capabilities
<!-- None. -->

## Impact

- **API** (`apps/api`): `PATCH /pools/:poolId` refuses name, season and rule changes on a locked pool; `PATCH /entries/:entryId` validates its body; `POST /pools/:poolId/entries` accepts an email alone and asks for a name only for an unknown account; `GET /pools/:poolId/entries` adds `invited` and `isYou` for admins. The activity record already covers all of these writes; the coverage test must still pass. **No schema change.**
- **Shared** (`packages/shared`): `createEntrySchema` (name optional), a new `updateEntrySchema`.
- **Dashboard** (`apps/dashboard`): new pages for the list, pool screen (three tabs), wizard; the old `AdminDashboard.tsx`, `AdminPoolsPanel.tsx` and `AdminPanelContext.tsx` are removed.
- **Tests:** API tests for the locked-rules refusal, status-edit validation and adding a player; browser specs for the roster edit (including restoring a knocked-out player), add player, picks before and after the lock, settings lock and unlock, delete, and the wizard; `pool-total`, `pick-privacy` and `frame` specs updated.
- **Design:** `admin-pools`, `admin-roster*`, `admin-picks*`, `admin-pool`, `admin-pool-delete`, `admin-pool-new` and the new-pool steps in `docs/v2/mockups/`.
- **Risk:** the roster edit changes who is alive, so it is validated on the server and recorded in Activity. The lock refusal is a small behaviour change, covered by tests. No schema change; rollback is a revert.
