## 1. Rule

- [ ] 1.1 `reveal_picks` (`at_lock` or `after_final_game`, default `at_lock`) in both rules schemas and the enum; unit test that old rules without it parse to the default

## 2. Server

- [ ] 2.1 `getRevealedWeeks` in `lib/pick-lock.ts` (locked weeks, minus weeks with a pending game for `after_final_game`); test both rules, a pending game, a decided week, a missing rule
- [ ] 2.2 `routes/picks.ts` uses it for `GET /entries/:id/picks` and `GET /pools/:id/picks`; tests: player sees none, admin sees "picked" only, own picks always, both pool types, revealed after the last result
- [ ] 2.3 `lib/pick-counts.ts` and `routes/tv.ts` follow the rule; test most picked is empty until revealed

## 3. Screens

- [ ] 3.1 Settings: the choice with an explanation, saved and locked with the rules
- [ ] 3.2 TV placeholder: "Shown when the week's games are final" for the later rule

## 4. Tests in a real browser

- [ ] 4.1 Settings e2e step: choose the later reveal, see it saved and locked
- [ ] 4.2 `e2e/pick-privacy.spec.ts` case: with the later rule, a locked week with a pending game hides others' picks; deciding the last game shows them

## 5. Verify and ship

- [ ] 5.1 `pnpm lint`, `typecheck`, `typecheck:e2e`, `test`, `test:e2e` pass
- [ ] 5.2 Push to `staging`, check, promote to `main` (no migration), confirm the deploy
- [ ] 5.3 Sync specs, archive, update ROADMAP and HANDOFF
