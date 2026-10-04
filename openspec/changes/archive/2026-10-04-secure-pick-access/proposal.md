## Why

The server decides who may see and change picks, but today it only checks that a request comes from someone signed in. Any player can read everyone's picks before a week locks, change or delete another player's pick if they know the entry's ID (and the player list hands those IDs out), and read every other player's email address. That breaks the pool's basic fairness rule (nobody sees anyone else's pick before the first kickoff) and leaks private data. It must be closed before the v2 launch, and before an admin who also plays (which is expected) can be trusted not to have an unfair view.

## What Changes

- **Only the owner can change a pick.** Submitting, changing or deleting a pick requires the entry to belong to the signed-in person. This applies to admins too: an admin cannot change another player's picks.
- **Picks stay private until the week locks.** Before a week's first kickoff, a signed-in person can read only their own picks. After it, everyone's picks for that week can be read.
- **Admins see who has picked, not what,** before the lock. For other players' unlocked weeks an admin gets a "has picked" marker with no team, so they can nudge people but not learn or exploit anyone's pick. Once the week locks they see everything.
- **Emails are private.** The player list returns each player's email only to admins and to that player. Everyone else gets name, status and points.
- **The dashboard follows:** player names on the standings page stop linking to other players' pick screens, the pick screen refuses an entry that isn't yours with a plain message, and the admin picks table shows "Picked" without a team until the lock.
- No database change. Nothing about how scoring, locking or elimination works changes.

## Capabilities

### New Capabilities
- `pick-access`: who may read, create, change or delete picks, when other people's picks become visible, and what admins and other players may see of a player list.

### Modified Capabilities
<!-- None. The project has no main specs yet. -->

## Impact

- **API** (`apps/api`): `src/routes/picks.ts` (ownership on write, visibility on read), `src/routes/entries.ts` (`resolveEntry` and the pool entry list: email only for admins and the owner), `src/lib/guards.ts` (a small ownership helper), a shared "which weeks are locked" lookup, new route tests with a stubbed session.
- **Dashboard** (`apps/dashboard`): `PoolStandings.tsx` (no links to others' pick screens), `PickScreen.tsx` (refuse a foreign entry), `AdminDashboard.tsx` picks tab and entries tab (handle a pick with no team; tolerate a missing email).
- **Shared** (`packages/shared`): the response shape for a pick whose team is hidden.
- **Dependencies:** none. **Schema:** none, so a rollback is a revert.
- **Risk:** this narrows what existing screens can load, so it is verified by tests that sign in as different people against a real database and by a two-account walk-through on staging.
