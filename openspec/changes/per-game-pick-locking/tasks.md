## 1. The rule and one lookup

- [ ] 1.1 `pickDeadlineRuleOf(pool)` (missing means whole-week) and `getTeamLock(season, week, team)` in `lib/pick-lock.ts` (game id, kickoff, result; null for a bye); a team is locked when its kickoff has passed or its result is not pending; unit tests incl. a bye and a moved kickoff
- [ ] 1.2 `POST /pools` defaults new pools to `per_game_kickoff` (schema default stays whole-week); test that a new pool gets it and an old pool does not

## 2. Writes

- [ ] 2.1 `routes/picks.ts` POST and DELETE: per-game checks (game exists, unlocked), survivor replace needs both games unlocked and clears the old result, pick 'em one pick per game, double-pick per pick; whole-week path untouched; test matrix incl. both pool types, bye, started game, replace across games, delete

## 3. Reads

- [ ] 3.1 `visiblePicks` takes a per-pick predicate; picks routes build it (game started or has a result, or week final for `after_final_game`); `pick-visibility.test.ts` extended, whole-week cases unchanged
- [ ] 3.2 `pickCounts` (TV most picked, recap) counts only started games for per-game pools; tests

## 4. State

- [ ] 4.1 `entry-state.ts` and `routes/home.ts`: per-game states and next-lock time, per-game `locked` flags in the pick sheet; `/nfl/weeks` and `admin-summary` use the one lock definition; tests for part-locked weeks, both pool types

## 5. Screens

- [ ] 5.1 Pick screen: started games shown and not selectable, locked picks marked, header shows the next lock, locked view only when nothing can change
- [ ] 5.2 Home copy and countdown follow the states; admin Next step and Picks tab copy follow the rule
- [ ] 5.3 Settings "When picks lock"; join page and new-pool wizard copy follow the pool's rule

## 6. Tests in a real browser

- [ ] 6.1 `e2e`: a per-game pool with Thursday started and Sunday open (pick Sunday, change it, cannot touch Thursday), then everything started shows locked; a whole-week pool still locks everything; Settings step; visibility as each game starts; update the specs that assert whole-week wording

## 7. Verify and ship

- [ ] 7.1 `pnpm lint`, `typecheck`, `typecheck:e2e`, `test`, `test:e2e` pass
- [ ] 7.2 One push to `main` (batch with other work; mind the Vercel build limit), check the deploy, then Robin switches his pool in Settings (unlock rules, "At each game's kickoff", lock) and watches a real week
- [ ] 7.3 Sync specs, archive, update ROADMAP, HANDOFF, the How to play and Admin guide copy
