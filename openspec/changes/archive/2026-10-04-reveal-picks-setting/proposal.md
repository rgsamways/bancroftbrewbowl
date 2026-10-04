## Why

Today other players' picks become visible when the week locks (its first kickoff). Robin wants an option for a pool to hold them back until the week's last game is final, for example so the table can't swap notes mid-weekend. Seeing late picks gives no real advantage (you still have to be right), so this is an option, not a fairness fix.

## What Changes

- New pool rule `reveal_picks` for both pool types: `at_lock` (today's behaviour, the default) or `after_final_game` (other players' picks stay hidden until every game of that week has a result).
- Admins set it in the pool's Settings with the other rules; it locks with them once the pool is running.
- The one place that decides who sees which pick follows the rule. A player's own picks are always visible. Before the reveal an admin still sees only "picked", never the team.
- The TV "most picked" list follows the same rule, so it can't leak what the picks screen hides.
- No migration: rules are stored as JSON, and a pool without the key behaves as `at_lock`.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `pick-access`: when other players' picks become visible depends on the pool's setting.
- `admin-pools`: the Settings screen has the new rule.
- `tv-standings`: most picked appears at the pool's reveal time, not always at the lock.

## Impact

- Shared: both rules schemas (`rules-config.ts`, `pick-em-rules-config.ts`), enum.
- API: `lib/pick-lock.ts` (a revealed-weeks lookup), `routes/picks.ts`, `lib/pick-counts.ts`, `routes/tv.ts`. `visiblePicks` already takes a set of weeks, so it keeps its shape.
- Dashboard: `pages/admin-pool/SettingsTab.tsx`, and the TV placeholder text.
- Tests: API (both rules, both pool types), a settings e2e step, a pick-privacy e2e case.
- Recap is unaffected (it only exists for fully decided weeks).
