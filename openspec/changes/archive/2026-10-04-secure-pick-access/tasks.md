## 1. Prove the holes first

- [x] 1.1 Add a route test helper that builds the Fastify app with a stubbed session (player A, player B, admin, signed out) and fixtures for a pool, two owned entries, a game and picks; verify a trivial authenticated request passes through it
- [x] 1.2 Write tests that reproduce today's problems: B reads A's picks before the lock, B changes A's pick, B deletes A's pick, an ordinary player sees other players' emails; verify they all FAIL against the current code (that is the proof the tests catch the holes)

## 2. Ownership on writes

- [x] 2.1 Add `requireEntryOwner` to `apps/api/src/lib/guards.ts` (403 "You can only change your own picks.", 404 unknown entry, 401 no session) and use it in `POST` and `DELETE` on entry picks; verify the 1.2 write tests now pass and the owner can still pick and unpick
- [x] 2.2 Add tests that an admin cannot change another player's pick, that an unclaimed entry (no owner) refuses a pick, and that the existing deadline message still appears after the first kickoff; verify they pass

## 3. Privacy on reads

- [x] 3.1 Add the shared "locked weeks" lookup, move the write routes onto it, and verify the existing deadline tests still pass
- [x] 3.2 Add the pure `visiblePicks` function with unit tests for every case in the design (own rows, locked other rows, unlocked other rows for a player and for an admin, an admin who owns an entry, an unowned entry, mixed weeks); verify the unit tests pass
- [x] 3.3 Use `visiblePicks` in `GET /entries/:entryId/picks` and `GET /pools/:poolId/picks`, add the hidden-team response shape to `packages/shared`, and verify the 1.2 read tests now pass plus tests for the admin marker and for everything becoming visible after the lock

## 4. Privacy of the player list

- [x] 4.1 Make `resolveEntry` take `includeEmail`, set it only for admins and for the caller's own entry in `GET /pools/:poolId/entries`, and verify with tests that a player sees no one else's email, an admin sees all, and points, status and names are all still returned

## 5. Dashboard

- [x] 5.1 Make player names on `PoolStandings` plain text, add the "That isn't your entry." state to `PickScreen`, and show "Picked" with no team in the admin `PicksTab`; verify `pnpm typecheck` passes and a Playwright walk at 390 by 844 shows each state (own pick screen works, foreign entry refused, standings without links, admin picks table before the lock)

## 6. Verify and ship

- [x] 6.1 Run `pnpm lint`, `pnpm typecheck` and `pnpm test` from the repo root and verify all pass
- [x] 6.2 Push to the `staging` branch and, with two real accounts on the staging preview and `api-staging`, verify: A cannot read or change B's picks before the lock, A can read B's picks once the week has locked, the player list shows A no emails, and an admin sees "has picked" with no team before the lock; record what was seen
- [x] 6.3 Update `openspec/ROADMAP.md`, sync specs, archive the change, promote `staging` to `main`, and repeat the two-account check on production _(promoted to `main` and confirmed the production API runs the new commit; the two-account check on production was deliberately skipped at Robin's decision on 2026-10-04, since it is the same code that passed 21 real-session checks on staging)_
