## Why

Several things Robin currently has to run in a terminal (loading the schedule, making an admin, helping someone who is locked out) need real screens, and the access has to be split: crucial site setup belongs to Robin's account alone, while everyday admin screens stay with Lark and any admin added later. As in his other projects, Robin is the "god-user".

## What Changes

- **A god-user level above admin.** An account whose verified email is in a server setting (`OPERATOR_EMAILS`, set to Robin's address in Railway) is the god-user: it passes every admin check without needing the admin flag, and it alone sees and can use the site-setup screens. It is not stored in the database, so nothing inside the app can grant or take it away.
- **Fairness rules still apply to the god-user.** It does not see anyone's pick early, cannot change anyone's pick, and still needs another admin to confirm decisions about its own entry. Those rules protect the pool, not the permissions.
- **Site-setup screens (god-user only), in More:**
  - **Schedule:** load a season's NFL schedule from ESPN (replaces the `seed-schedule` script's schedule part): choose the season, see what would be added, then Apply. New games start undecided; results still come from Check for results.
  - **Admins:** list admins, add one by email (the person must have signed in once), remove one. The last admin cannot be removed, and the god-user's account cannot be removed from the list (replaces `make-admin`).
  - **Help someone sign in:** find a player by email, then sign them out everywhere and remove their password so they can use an emailed link (replaces the safe part of `reset-password`). A temporary-password option is left out until the owner asks.
- **Everyday admin screens stay as they are** for Lark and any new admin.
- Every setup action writes one Activity record under the person's name.
- No schema change.

## Capabilities

### New Capabilities
- `operator-access`: the god-user level and what it can and cannot do.
- `schedule-load`: loading a season's schedule from a screen.
- `admin-management`: listing, adding and removing admins from a screen.
- `player-sign-in-help`: signing a locked-out player out and removing their password.

### Modified Capabilities
- `admin-steps`: More shows the setup screens to the god-user only.

## Impact

- API: `lib/guards.ts` (`isOperator`, `requireOperator`, `requireAdmin` accepts the god-user), `lib/espn.ts` reused by a schedule loader, new routes for schedule, admins and sign-in help; new Activity kinds; `.env.example` and Railway variable `OPERATOR_EMAILS`.
- Shared: `isOperator` flag on the session summary, Activity kinds.
- Dashboard: three screens under More (only shown to the god-user), the Admin tab for a god-user who is not flagged admin.
- Docs: `docs/ROLES_AND_RULES.md` (the operator is now the god-user account; schedule import, admin management and sign-in help are theirs), the `make-admin`, `seed-schedule` and `reset-password` scripts stay as a backup.
- Tests: guards, each route (god-user, admin, player, signed out), the safeguards, e2e for each screen.
