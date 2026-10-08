## 1. The rule and one lookup

- [x] 1.1 `pickDeadlineRuleOf(pool)` (missing means whole-week) and `getTeamLock(season, week, team)` in `lib/pick-lock.ts` (game id, kickoff, result; null for a bye); a team is locked when its kickoff has passed or its result is not pending; unit tests incl. a bye and a moved kickoff
- [x] 1.2 `POST /pools` defaults new pools to `per_game_kickoff` (schema default stays whole-week); test that a new pool gets it and an old pool does not

- [x] 1.3 Tests use non-Sunday kickoffs on purpose: a Wednesday and a Friday game, a Saturday game, a week whose first game is a Friday, and a Thanksgiving-style three-game Thursday; whole-week and per-game both behave correctly

## 2. Writes

- [x] 2.1 `routes/picks.ts` POST and DELETE: per-game checks (game exists, unlocked), survivor replace needs both games unlocked and clears the old result, pick 'em one pick per game, double-pick per pick; whole-week path untouched; test matrix incl. both pool types, bye, started game, replace across games, delete

## 3. Reads

- [x] 3.1 `visiblePicks` takes a per-pick predicate; picks routes build it (game started or has a result, or week final for `after_final_game`); `pick-visibility.test.ts` extended, whole-week cases unchanged
- [x] 3.2 `pickCounts` (TV most picked, recap) counts only started games for per-game pools; tests

## 4. State

- [x] 4.1 `entry-state.ts` and `routes/home.ts`: per-game states and next-lock time, per-game `locked` flags in the pick sheet; tests for part-locked weeks, both pool types. (The admin Next step and `/nfl/weeks` stay week-level on purpose, since they are not per pool; their wording was changed to be true for both rules: "Games under way", "First game kicked off".)

## 5. Screens

- [x] 5.1 Pick screen: started games shown and not selectable, locked picks marked, header shows the next lock, locked view only when nothing can change
- [x] 5.2 Home copy and countdown follow the states; admin Next step and Picks tab copy follow the rule
- [x] 5.3 Settings "When picks lock"; join page and new-pool wizard copy follow the pool's rule

## 6. Tests in a real browser

- [x] 6.1 `e2e`: a per-game pool with Thursday started and Sunday open (pick Sunday, change it, cannot touch Thursday), then everything started shows locked; a whole-week pool still locks everything; Settings step; visibility as each game starts; update the specs that assert whole-week wording

## 6b. Moved kickoffs

- [x] 6b.1 `previewEspnResults` also asks ESPN about the current week and the next two weeks (flexes are announced ahead, and those weeks have not kicked off, so they were not asked before) and returns games whose kickoff differs from ESPN's by more than a minute (not started, no result); `applyEspnResults` (or a separate apply field) updates those kickoffs and never touches a started game; one Activity record covers it; tests incl. a game flexed from Sunday to Monday night and one moved earlier
- [x] 6b.2 Results screen shows "N games moved" with the old and new time in the Check for results card, applied with the same confirm; e2e with the ESPN stub

## 7. Verify and ship

- [x] 7.1 `pnpm lint`, `typecheck`, `typecheck:e2e`, `test`, `test:e2e` pass
- [x] 7.2 One push to `main` (batch with other work; mind the Vercel build limit), check the deploy, then Robin switches his pool in Settings (unlock rules, "At each game's kickoff", lock) and watches a real week
- [x] 7.3 Sync specs, archive, update ROADMAP, HANDOFF, the How to play and Admin guide copy
