## 1. The god-user

- [x] 1.1 `OPERATOR_EMAILS` read once (case-insensitive, verified email only); `isOperator(session)` and `requireOperator` in `lib/guards.ts`; `requireAdmin` accepts the god-user; `isOperator` on the session summary; `.env.example` entry; unit and route tests for god-user, admin, player, signed out, unverified email
- [x] 1.2 Tests that the god-user still cannot see unrevealed picks, change another player's pick, or skip the confirm rule for their own entry

## 2. Shared logic moved out of the scripts

- [x] 2.1 The schedule diff lives in `lib/schedule-load.ts` on the shared ESPN reader; the scripts (`seed-schedule`, `make-admin`, `reset-password`) stay as a developer backup and still work

## 3. Routes

- [x] 3.1 Schedule: `GET /operator/schedule?season=` (preview) and `POST /operator/schedule` (apply); new games undecided, kickoffs of unstarted games only, never a result; Activity record; tests with a fake ESPN reader incl. a flexed and a started game
- [x] 3.2 Admins: `GET /operator/admins`, `POST` add by email, `DELETE` remove; refuses last admin and the god-user's account; Activity records; tests
- [x] 3.3 Help someone sign in: `POST /operator/players/:userId/sign-in-reset`; ends sessions, removes the credential password, refuses the god-user's own account; Activity record; test that the emailed-link path still works

## 4. Screens

- [x] 4.1 More: a "Site setup" section for the god-user; Admin tab for a god-user who is not flagged admin; other admins never see it and are sent away from the addresses
- [x] 4.2 Schedule screen (season, preview, Apply, states); Admins screen (list, add, remove with confirmation); Help someone sign in (find the player by email, then the explanation and a confirmation)

## 5. Tests in a real browser

- [x] 5.1 e2e with a fixed god-user address set as `OPERATOR_EMAILS` for the test API: each screen end to end, an ordinary admin does not see them, a player is refused; update specs that list More links

## 6. Docs

- [x] 6.1 `docs/ROLES_AND_RULES.md` (the god-user, which rules are theirs), the Admin guide (what Lark sees vs. Robin), `NEW_CLIENT_SETUP.md` (set `OPERATOR_EMAILS`), HANDOFF and ROADMAP

## 7. Verify and ship

- [x] 7.1 `pnpm lint`, `typecheck`, `typecheck:e2e`, `test`, `test:e2e` pass
- [ ] 7.2 Set `OPERATOR_EMAILS` in Railway (production and staging) to Robin's address before the deploy, then one push to `main` (mind the Vercel build limit); confirm the screens appear for Robin and not for Lark
- [ ] 7.3 Sync specs, archive, update ROADMAP and HANDOFF
