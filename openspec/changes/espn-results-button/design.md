## Context

See proposal.md. Results are saved by `POST /nfl/games/:gameId/result` (`routes/nfl.ts`), which sets the result, calls `scoreGame` (`lib/scoring.ts`) and records Activity. `scripts/seed-schedule.ts` already reads ESPN's scoreboard (`site.api.espn.com`, per week) and maps teams, winners and ties, but writes results straight to the games without scoring. The ESPN endpoint is public and unofficial.

## Goals / Non-Goals

**Goals:** a safe one-tap weekly update that scores the same way a hand-entered result does; the admin sees exactly what will change before it does.

**Non-Goals:** scheduled or automatic updates; correcting a result that was already entered; live scores; using any provider other than ESPN; changing how scoring works.

## Decisions

- **Preview, then confirm.** `GET /admin/results/espn` fetches and returns what would change; nothing is written. `POST /admin/results/espn/apply` takes the game ids the admin saw, **re-fetches ESPN itself** and applies only games that are still undecided here and still final on ESPN. The browser never supplies a result, so a stale or tampered preview can't write a wrong score.
- **Reuse the real scoring path.** Apply saves the result then calls `scoreGame` per game, so survivor eliminations, mulligans, held wipeouts and pick 'em all behave exactly as for hand entry. The response lists any wipeout so the screen can send the admin to the decision.
- **Never overwrite.** Only `pending` games are filled. Games already decided that ESPN reports differently are returned as "differs" for the admin to look at, and left alone. Corrections stay deliberate, through the existing change flow.
- **Which weeks to ask ESPN about:** only weeks of the latest season whose first kickoff has passed and that still have an undecided game (usually one or two calls), not all 18.
- **A shared reader, `lib/espn.ts`.** Fetch with a timeout, parse, map to our team codes (WSH to WAS), decide home win, away win or tie. The schedule script is changed to use it, with no change to what it does. The base URL comes from `ESPN_BASE_URL` (default the real one) so tests can point it at a stub.
- **One Activity record per import,** kind `results_imported`, with the count and the games, flagged when the admin's own entry changed (the same before/after check the single-result route uses). This is a new admin write route, so the existing coverage test requires the record.
- **Admin only for now;** a later `import_results` rule fits the staff roles.
- **Season choice:** the latest season that has games, the same way Next step and Results do.
- **Errors say what to do:** ESPN unreachable, slow (8 second timeout) or malformed gives a plain message and "enter results by hand below"; nothing is half-applied, because each game is saved and scored on its own and the response says which succeeded.

## Risks / Trade-offs

- ESPN's endpoint is unofficial and can change. The manual screens remain the backup, and the reader is one small file.
- A game ESPN marks final that is later corrected: we don't overwrite, the admin corrects by hand.
- Postponed or abandoned games stay undecided (not final on ESPN), which is correct.
- Applying many games at once scores pools sequentially; at this size it takes well under a second per game.
