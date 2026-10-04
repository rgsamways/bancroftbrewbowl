## Why

Standings is the screen players open to answer "how am I doing and who else is still in?" Today it is two plain lists with no summary, no way to find a friend among 60 players, no shared ranks for pick 'em, and the Standings tab is an interim chooser. The v2 mockups (`standings.html`, `standings-pickem.html`) give it a summary card, a search, and short lists with "Show all". This is slice 7 of the v2 build (`docs/v2/V2_BUILD_PLAN.md`), and it reuses the shared ranking from slice 6.

## What Changes

- **Standings screen** rebuilt for both pool types, fed by one request, `GET /pools/:poolId/standings`, so counts, ranks and "after week N" come from the server and the phone does no counting.
- **Survivor:** a summary card ("You're still alive", "38 of 64 still alive", "After week 4 · 26 players out so far"), the pool total card from slice 5, **Find a player**, a "Still alive" list (you first, then A to Z) and an "Eliminated" list (most recent first, "Out in week N"), each showing a short list with **Show all N**.
- **Pick 'em:** a summary card (rank phrase such as "T4 tied for 4th of 41 players", "31 points · 7 behind the leader"), the pool total card, Find a player, and a **leaderboard** with shared ranks ("T4") that skip after a tie, "Leaderboard after week N", and "Points update as the brewery adds game results."
- **Pool tabs** at the top when a player is in more than one pool; the **Standings tab** goes straight to the pool that needs attention (same choice as Home and Pick) instead of the interim list.
- Your own row is marked "You" and still links to your pick screen; nobody else's row links anywhere. Emails are never sent.
- A finished season says "Final standings".
- Tests in `e2e/` and the API are updated and extended.
- Out of scope: the TV standings and weekly recap (slice 13), the admin roster and picks tables (slice 9), per-week history, and any database change.

## Capabilities

### New Capabilities
- `standings`: what the Standings screen shows for survivor and pick 'em pools, the search and "Show all" behaviour, shared ranks, pool tabs, and the one request that supplies it.

### Modified Capabilities
<!-- None. The pool total card (pool-total) is reused unchanged. -->

## Impact

- **API** (`apps/api`): new `GET /pools/:poolId/standings` (session required) built on the existing points calculation and the slice 6 week helpers. **No schema change.**
- **Shared** (`packages/shared`): the standings response type and a small `initials` helper moved from the dashboard header so the list avatars match it.
- **Dashboard** (`apps/dashboard`): `PoolStandings.tsx` rewritten; the Standings tab landing replaced; `TabLanding.tsx` and the unused part of `lib/tabs.ts` removed.
- **Tests:** API tests for both pool types, ties, ordering and privacy; `e2e/standings.spec.ts` and `e2e/frame.spec.ts` / `e2e/pick-privacy.spec.ts` updated; new browser checks for search, Show all, tabs and the tab redirect.
- **Design:** `standings.html` and `standings-pickem.html` in `docs/v2/mockups/`.
- **Risk:** low. Read-only screen, no schema change; rollback is a revert. The one privacy question (what other players can see) is unchanged: names, status, elimination week and points were already visible to every pool member.
