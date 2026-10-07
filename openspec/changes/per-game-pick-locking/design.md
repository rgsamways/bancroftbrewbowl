## Context

See proposal.md. The lock is "a week locks at its first kickoff" (`lib/pick-lock.ts`), but about six places compute it separately: `loadSeasonWeeks`, `routes/nfl.ts` (`/nfl/weeks`), `admin-summary.ts`, `tv.ts`, `entry-state.ts` and two operator scripts. Picks are keyed by (entry, week, team) and joined to games by team code. Scoring is per game and assumes nothing about lock timing.

## Goals / Non-Goals

**Goals:** per-game locking behind the existing pool rule; correct on every screen; no way to change a pick whose game has started.

**Non-Goals:** per-game lock changes for pools using the whole-week rule (they must behave exactly as today); a "locked forever" timestamp column; real-time anything.

## Decisions

- **Reuse `pick_deadline_rule`.** `pickDeadlineRuleOf(pool)` (missing means whole-week) sits beside `revealRuleOf`. Every lock decision asks the rule, so the whole-week path stays untouched.
- **Schema default stays whole-week; new pools made in the app get per-game.** Changing the zod default would flip every test fixture and any stored rules missing the key. Instead `POST /pools` (via `defaultRulesForType`) and the wizard set per-game for newly created pools. Robin's pool is switched in Settings.
- **One lookup, `getTeamLock(season, week, team)`:** returns the team's game (id, kickoff, result) or null for a bye. A pick is locked when `now >= kickoff` **or the game's result is not pending**, so a kickoff moved later after the game was played cannot reopen it.
- **Writes (per-game pools):**
  - Pick a team: its game must exist (else the existing "doesn't play" 400) and be unlocked (else 409 "That game has started").
  - Survivor single-slot replace: both the old team's game and the new team's game must be unlocked; the replaced pick's `result` is reset to pending.
  - Delete: the removed team's game must be unlocked (today's delete never looked at a team).
  - Pick 'em: at most one pick per game; picking a team replaces the pick on the other team of the same game if that game is unlocked.
  - Double-pick weeks: limit stays 2; each pick follows the same per-team rule.
  - Whole-week pools run today's code path unchanged.
- **Reads (visibility):** `visiblePicks` takes a predicate for "this pick's game has started" instead of a set of weeks. Under `at_lock` a pick is visible when its own game has started (or has a result); under `after_final_game` the week must be fully decided (unchanged). Whole-week pools build the predicate from the week set, so behaviour and existing tests are unchanged.
- **Most picked / counts:** for per-game pools count only picks whose game has started, and compute shares among those picks, so a partial week cannot leak unstarted picks. Whole-week pools unchanged.
- **Entry state for a part-locked week.** The pick sheet already carries every game's kickoff and result; the server now also marks each game `locked`.
  - Survivor: `locked` when its pick's game has started (nothing more to do), or every game has started; `picked` while its pick is still changeable; `needs_picks` while no pick and some game is open.
  - Pick 'em: `needs_picks` while any unstarted game lacks a pick; `locked` once every game has started.
  - `lockTime` in the summary becomes "the next lock that matters to this entry": its own pick's kickoff when picked, else the next kickoff of an open game. Home's countdown reads it as before.
- **One definition of the lock rule.** `/nfl/weeks` and `admin-summary` stop computing their own and use `pick-lock.ts`; for per-game pools "locked" means every game has started.
- **Races:** the lock check and write are not in one transaction today (a pick sent at the exact kickoff second can land either side). Per-game does not make that worse; the extra "result is not pending" check closes the worst case.
- **Scoring:** unchanged. A pick for a team can only change before that team's game starts, which is before its result, so a scored pick can never change; the replace guard and the cleared `result` make that explicit. A survivor eliminated mid-week is already refused further picks.
- **Operator scripts** (`clear-early-picks`, `check-late-start`) work on past weeks and need no change.

## Risks / Trade-offs

- This touches the core pick rules. The whole-week path stays byte-for-byte as is and keeps its tests; per-game gets its own matrix of cases (before and after kickoff, bye, replace across games, pick 'em one per game, double-pick, visibility, counts, summary states, Pick screen).
- Waiting for late games is a mild advantage over people who locked early; Robin judged it acceptable.
- A game moved earlier locks earlier; moved later after it started stays locked only if it has a result. Rare, and flagged in Activity-free reality: the admin controls the schedule import.
- Copy that says "first game of the week" appears in several places and must follow the pool's rule.
