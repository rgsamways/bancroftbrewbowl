## Context

See proposal.md for why. Facts checked in the code while planning this:

- `apps/api/src/lib/guards.ts` has `requireSession` and `requireAdmin`. Every pick route uses only `requireSession`.
- `apps/api/src/routes/picks.ts`: `POST /entries/:entryId/picks`, `DELETE /entries/:entryId/picks/:weekNumber/:teamCode`, `GET /entries/:entryId/picks` and `GET /pools/:poolId/picks`. None checks who owns the entry. The two reads return every pick with no regard to the lock.
- `entries.userId` already links an entry to its owner. An entry an admin added by email has no `userId` until that person signs in and claims it (`claimInvitedEntries` in `src/auth.ts`).
- A week locks at `MIN(games.kickoffTime)` for that season and week. The write routes compute it inline. The pool rule `pick_deadline_rule` (including `per_game_kickoff`) exists in the settings but is **not read by any server code**, so the first kickoff of the week is the only lock today.
- `GET /pools/:poolId/entries` returns `resolveEntry(...)`, which always includes the email. The standings page and the admin Entries tab both call it.
- Dashboard callers: `PickScreen.tsx` (own entry only, but reachable for any entry through the standings links), `PoolStandings.tsx` (links every alive entry to its pick screen), and the admin `PicksTab` and `EntriesTab` in `AdminDashboard.tsx`.
- Tests run with vitest against a real Postgres (`apps/api/src/test/`). Existing tests exercise functions, not routes.

## Goals / Non-Goals

**Goals:**
- Writes only by the owner, reads private until the lock, emails private, enforced on the server so no screen can bypass it.
- The visibility rule is a small pure function with exhaustive tests, separate from the routes.
- An admin who also plays gets no extra view of other players' picks before the lock.

**Non-Goals:**
- Letting admins enter or change a pick for someone else (for example a phone-in). That would be its own audited feature.
- A role or rules model beyond the existing admin flag, an admin activity log, or conflict-of-interest handling for admins. Those are covered in `docs/ROLES_AND_RULES.md` and are separate changes.
- Implementing the `per_game_kickoff` deadline rule.
- Changing how locking, scoring or elimination work.

## Decisions

### 1. Ownership is checked in one helper, and admins are not exempt
Add `requireEntryOwner(request, reply, entryId)` next to the other guards. It resolves the session, loads the entry, and refuses unless `entry.userId === session.user.id`. Refusal is 403 with "You can only change your own picks."; an unknown entry stays 404; no session stays 401. `POST` and `DELETE` both use it.
*Alternatives:* exempt admins so they can fix mistakes (rejected: an admin who plays could then change picks, which is exactly what we are preventing); return 404 for foreign entries to hide their existence (rejected: entry IDs are no longer secret-bearing once ownership is checked, and a plain 403 gives a clear message).

### 2. Which weeks are locked comes from one lookup
A helper returns the set of week numbers for a season whose first kickoff has passed, using the same `MIN(kickoffTime)` the write routes use. The write routes are moved onto it so reads and writes cannot disagree about the lock.

### 3. The redaction is a pure function
`visiblePicks({ rows, viewer: { userId, isAdmin }, lockedWeeks })` takes rows that include each entry's owner and returns what that viewer may see:
- own entry's rows: always, in full;
- other entries' rows in a locked week: in full;
- other entries' rows in an unlocked week: removed for a player, and for an admin replaced by `{ entryId, weekNumber, teamCode: null, result: null, submitted: true }`.
Both read routes call it, so there is exactly one rule. It gets its own unit tests, including: no viewer, a player who is also the owner, an admin who owns an entry, mixed locked and unlocked weeks, and an entry with no owner.
*Alternative:* filter inside each SQL query (rejected: two copies of a security rule, harder to test).

### 4. Emails: redact in the response shape, decided per row
`resolveEntry` takes an `includeEmail` flag. The list route sets it for an admin, and for the single entry owned by the caller, and not otherwise. The admin-only creation route is unchanged. The standings page needs none of the email, so nothing visible breaks.

### 5. The dashboard stops offering what is refused
`PoolStandings` renders other players as plain text. `PickScreen` loads the entry through `/me/entries` first and shows "That isn't your entry." with a link back if the ID isn't the caller's. The admin `PicksTab` renders a pick with no team as "Picked", and `EntriesTab` already tolerates an empty email.

### 6. Tests call the real routes with a stubbed session
A small test helper builds the Fastify app and stubs `getSession`, so a test can act as "player A", "player B" or "admin" and hit the real routes against the real database. The first tests written reproduce today's holes and fail before the fix, which proves the fix is what makes them pass.

## Risks / Trade-offs

- **A screen quietly depended on seeing everyone's picks early** → the only callers are the ones listed above; each is updated and covered by the checks in tasks.md.
- **The `per_game_kickoff` rule is later implemented and diverges from the week lock** → noted in the helper's comment and in this design; whoever implements it must change the lock lookup, which both reads and writes share.
- **An admin legitimately needs to fix a pick (a player phones it in)** → not supported on purpose; handled as a separate, audited feature if wanted.
- **Clock differences between the server and the real kickoff** → unchanged from today's behaviour, since the same timestamp is used.
- **Entries nobody has claimed cannot be picked for** → correct; the person must sign in once, which also claims the entry.

## Migration Plan

1. No schema change.
2. Ship to the `staging` branch and test with two real accounts: player A cannot read or change player B's picks before the lock; after the lock A can read B's; the player list shows no emails to A; an admin sees "has picked" with no team before the lock.
3. Promote `staging` to `main` (pre-authorised for the routine finish), then re-check the same on production.
4. Rollback is a revert.
