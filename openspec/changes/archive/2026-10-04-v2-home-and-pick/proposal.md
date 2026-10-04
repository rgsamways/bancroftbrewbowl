## Why

Home and Pick are the heart of the player experience, and today they are the old screens: a plain list of pools, a grid of 32 team codes with no kickoff times, no countdown, no sense of "what do I need to do right now", and a Home that makes about eight separate requests and still shows the retired canned offers. On bar Wi-Fi, with a phone in one hand, a player should see one clear card ("make your pick, locks in 2d 14h") and finish in two taps. This is slice 6 of the v2 build (`docs/v2/V2_BUILD_PLAN.md`).

## What Changes

- **Home** becomes a hero card for the entry that needs attention, with a **pool switcher** (chips under the header) when the player is in more than one pool. The hero has one state per situation, for survivor and pick 'em: not picked, picked, locked, out, season over, no pools open, and the existing first-run welcome for a player in no pool. Each shows the pool line (players left, or points and rank), a **countdown to the lock**, and one main button.
- **One new request, `GET /me/summary`,** returns everything Home needs per entry (pool, status, state, week, lock time, picks made, players left, points, rank), plus the server's current time so countdowns do not trust the phone's clock.
- **Pick screen** becomes a list of the week's games grouped by day with kickoff times (Eastern), team cards, teams used earlier dimmed and labelled "Used week N", a **confirm bar** for survivor ("Lock in Chiefs"), the **double-pick week** (two teams, "Lock in 2 picks"), **tap-to-pick** for pick 'em with "N games left to pick" and a **Jump to next** link, plus locked, eliminated ("Your season", with pick history) and "That isn't your entry" states. One request, `GET /entries/:entryId/pick-sheet`, feeds it.
- **Join a pool** gets its own page with the rules in plain words ("Join Sunday Survivor" / "Not now"), and a "pool finished" page. Home links to it for pools the player is not in. An eliminated survivor player is offered an open Pick 'Em pool.
- **Pick tab** (`/pick`) uses the same "needs attention" choice as Home instead of the interim chooser.
- **Server rule:** a pick for a team that has no game that week is refused.
- **Lives stay hidden** on every player screen (the `mulligans_allowed` setting stays). The retired canned offers and promotion blurbs leave the player Home.
- **Shared:** a competition-ranking helper ("T4", next rank skips) for pick 'em, reused by Standings in slice 7; time and countdown helpers.
- Tests in `e2e/` are updated and extended for every state.
- Out of scope (decided with Robin): the "At the brewery" cards (slices 11 to 13), the full-screen "Tough break" moment and the "added by the brewery" notice (no stored flag; Home's "You're out" covers it), the Menu tab, the Standings redesign (slice 7), and any database change.

## Capabilities

### New Capabilities
- `home`: the Home hero, its states, the pool switcher, the countdown, and the summary the server provides.
- `pick-screen`: the Pick screen in all its states and the server rule that a picked team must play that week.
- `join-pool`: joining a pool from its own page, the finished-pool page, and the Pick 'Em offer to eliminated players.

### Modified Capabilities
<!-- None. pick-access (who may read or change a pick) is unchanged. -->

## Impact

- **API** (`apps/api`): new `GET /me/summary` and `GET /entries/:entryId/pick-sheet` (owner only), a "team plays that week" check on `POST /entries/:entryId/picks`, shared week/lock helpers. **No schema change.**
- **Shared** (`packages/shared`): ranking, countdown and Eastern-time helpers and the summary/pick-sheet types.
- **Dashboard** (`apps/dashboard`): `Home.tsx` rewritten, `PickScreen.tsx` rewritten, new join pages, `TabLanding.tsx` / `lib/tabs.ts` Pick-tab logic reworked, new small components (pool chips, countdown, game card, confirm bar).
- **Tests:** API tests for the summary states, rank ties, the pick sheet and the new pick check; e2e specs `join-and-pick`, `pick-privacy`, `frame` updated and new specs for each Home and Pick state (including a locked week, which needs past kickoffs in the test helper).
- **Design:** `home*.html`, `pick*.html`, `pick-pickem*.html`, `pick-eliminated.html`, `pick-not-yours.html`, `join*.html` in `docs/v2/mockups/`.
- **Risk:** high traffic path and the biggest slice. Mitigations: no schema change, so rollback is a revert; server-authoritative locking is unchanged; each state is covered by a browser check. If it grows, split at the Home / Pick boundary (the summary and pick sheet endpoints are independent).
