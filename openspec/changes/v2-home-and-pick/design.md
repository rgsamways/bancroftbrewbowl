## Context

Home today makes about eight requests (`/me/entries`, `/pools`, then seasons, weeks, games, promotions and canned promotions) and decides "current week" on the phone. `PickScreen` decides it differently (first week not locked), shows a grid of 32 team codes with no kickoffs, and has no locked or eliminated view. The lock rule is the first kickoff of the week (`lib/pick-lock.ts`); `per_game_kickoff` exists in settings but nothing reads it. Kickoff times are stored without a time zone. Slice 1 (`pick-access`) already makes pick reads and writes owner-only; that does not change. See proposal.md for the why and the choices made with Robin.

## Goals / Non-Goals

**Goals:**
- Home in one request; Pick screen in one request; both correct on bad Wi-Fi.
- One server-side definition of "current week" and "state" that Home, Pick and the Pick tab all use.
- Every state in the mockups reachable and tested.

**Non-Goals:**
- Any schema change; the brewery cards, music, menu, announcements; the elimination full-screen moment; the Standings redesign; per-game locking (`per_game_kickoff`).

## Decisions

- **Server-side state machine in one shared module (`apps/api/src/lib/entry-state.ts`).** Given an entry, its pool, the season's games and the entry's picks, it returns the current week, lock time and one of: `needs_picks`, `picked`, `locked`, `eliminated`, `season_over`. Both new endpoints call it, so the screens cannot disagree. Alternative: compute on the phone as today. Rejected: that is how Home and Pick came to disagree.
- **Current week.** The latest season that has any games; its first week whose games are not all decided (`completed` false); if every week is decided, the entry is `season_over`. A week is `locked` once server time passes its first kickoff and not yet decided. An eliminated entry is `eliminated` regardless of week. Between weeks (week decided, next not yet open) the next week is simply the first not-decided one, so Home shows its pick state with its real lock time. A season with no games imported has no weeks and shows no pick state ("No games scheduled yet"). Alternative: reuse PickScreen's "first unlocked" rule. Rejected: after a lock it jumps to next week and hides the locked state the mockups require.
- **Server time.** Both endpoints return `serverNow` (ISO, UTC). The dashboard stores `offset = serverNow - Date.now()` once per response and counts down with `Date.now() + offset`. Kickoffs are serialised as UTC ISO strings (the columns are timezone-less; the existing code already treats them as UTC, confirmed in task 1) and displayed with `Intl.DateTimeFormat` in `America/Toronto`. At zero the client shows the locked state and refetches; the server stays the only authority for refusing late picks.
- **Rank for pick 'em is a shared pure function.** `rankWithTies(scores)` returns competition ranks (1,2,2,4) and a "T" flag, built on the existing `computePickEmPoints`. Slice 7 reuses it. A pool where everyone has 0 points ranks everyone "T1", which is shown as is (no special case).
- **Players left, picks made.** Computed in SQL/aggregates per pool in the summary; no per-player data leaves the server. For survivor, "left" counts `status = alive`; "total" counts entries. For pick 'em, picks made and total games are for the current week.
- **Pick sheet endpoint instead of five calls.** `GET /entries/:entryId/pick-sheet` is owner only (reusing `requireEntryOwner`'s 401/404/403). It returns games with kickoff/result, the entry's picks with results, used teams with week, the pick limit and the state. The dashboard shows "That isn't your entry" on 403, so no data is fetched for strangers.
- **Team-plays-that-week check on the server.** `POST /entries/:entryId/picks` looks up the week's games and refuses a team not in them. Cheap, and makes the screen's "only these games" rule real.
- **Survivor confirm is client state, saved with the existing endpoints.** Select sets local state; "Lock in" calls `POST` (single-pick weeks replace in place). Double-pick weeks insert two picks and change by `DELETE` then `POST`; on a partial failure the screen refetches the sheet and says which pick did not save. An atomic "set picks" endpoint was considered and rejected for now: it adds API surface for a rare failure, and the refetch shows the truth.
- **Pick 'em saves on tap, one request per tap, last tap wins.** Taps on the same game are serialised per game on the client so rapid taps cannot interleave a delete and a post.
- **Pool switcher is local state, not a route.** Chips under the header; the selected pool is kept in `sessionStorage` so returning to Home keeps it. Default = the hero order in the home spec.
- **Join is a page, not a button.** `/join/:poolId` shows rules and the name; it calls the existing idempotent `POST /pools/:poolId/join`. The first-run welcome's buttons become links to it. Name shown is the account name (pools use it today); "Change" goes to Me.
- **Old Home pieces removed from the player flow:** the weekly games list, promotions and canned-promotion blurbs. The admin pages that manage them are untouched.
- **Tab bar untouched.** No Menu tab until a menu exists (slice 11), so `frame.spec.ts` tab expectations hold.

## Risks / Trade-offs

- [Biggest slice, many states] → each state has an API test (state machine) and a browser check; if it runs long, split at Home / Pick since the endpoints are independent.
- [State machine disagrees with scoring around mulligans] → "out" is `entry.status === eliminated` only; nothing reveals a saved life. Tested with a mulligan pool.
- [Timezone] → confirm in task 1 that stored kickoffs are UTC; pin with a test that a known kickoff displays as the right Eastern time.
- [Between-weeks or empty-season edge cases] → explicit states and tests for no games, all decided, and a week with one game.
- [Rapid pick 'em taps] → per-game serialisation and a test with two quick taps.
- [Replacing the Pick tab chooser changes e2e expectations] → the e2e specs that assert the old copy are rewritten in the same change.
- [Players left leaks something] → only counts are returned; covered by a test that the summary has no other player's picks or email.

## Migration Plan

No data change. Push to `staging`, walk each state in real Chrome (locally, since the staging preview cannot reach the staging API) and check the two new endpoints on `api-staging`, then promote. Rollback is a revert of the commit.

## Open Questions

- Whether to show Eastern time with the zone ("ET") on kickoffs. Default: no suffix, as in the mockups; trivial to add later.
