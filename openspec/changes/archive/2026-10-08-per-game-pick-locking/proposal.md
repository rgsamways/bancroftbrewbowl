## Why

Today a whole week locks at its first kickoff, so a Thursday game locks every pick for the week. Robin wants players to be able to pick the team they want right up until that team's game starts, so Sunday and Monday teams stay open after the Thursday game. The pool rule `pick_deadline_rule` (`first_kickoff_of_week` or `per_game_kickoff`) already exists but nothing reads it.

## What Changes

- A pool with `per_game_kickoff` locks each pick at its own game's kickoff: a team can be picked, changed or removed until its game starts. A game that has started, or already has a result, is locked for good.
- Survivor: you can change your pick to any team whose game hasn't started, as long as the game of the team you are leaving also hasn't started. Double-pick weeks follow the same rule per pick.
- Pick 'em: one pick per game (the server now enforces it), each locking at its own kickoff.
- Other players' picks become visible **as each game starts** (not at the week's first kickoff). The existing "after the week's last game is final" reveal rule still holds everything until the week is done.
- Home, Pick, the TV most-picked list and admin screens understand a week that is part-locked.
- A pool setting "When picks lock" in Settings (locks with the other rules). **New pools created in the app default to per-game; the schema default stays whole-week**, so existing pools and stored data behave exactly as before. Robin's current pool is switched by an admin in Settings.
- Safeguards: a pick whose game has a result is locked even if its kickoff was later moved, and a replaced pick's old result is cleared.
- Any day of the week: locks come from each game's real kickoff, so Wednesday, Friday and Saturday games (holiday weeks, special games) work with no special handling, and a week's first game can be on any day.
- Kickoff times must be right for per-game locks to be right, and the NFL moves games (flex scheduling). "Check for results" also notices games ESPN has moved and, on Apply, updates the kickoff of games that haven't started.
- No schema change (rules are JSON).

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `pick-screen`: per-game locking on the Pick screen.
- `pick-access`: per-game rules for writing picks and when other players' picks show.
- `home`: states and countdown for a part-locked week.
- `admin-pools`: the "When picks lock" setting.
- `tv-standings`: most picked follows per-game visibility.
- `espn-results`: moved kickoffs are shown and applied.

## Impact

- API: `lib/pick-lock.ts` (rule reader, per-team lock lookup), `routes/picks.ts` (write and read paths), `lib/pick-visibility.ts`, `lib/pick-counts.ts`, `lib/entry-state.ts`, `routes/home.ts`, `routes/admin-summary.ts`, `routes/nfl.ts`, `routes/tv.ts`, `routes/pools.ts` (new pools default).
- Dashboard: Pick screen, Home copy and countdown, Settings, join page and new-pool wizard copy, admin Picks tab copy.
- Shared: rules text, summary and pick-sheet types (per-game locked flags, next lock time).
- Tests: many existing lock tests are for the whole-week rule and stay valid; per-game cases are added beside them.
