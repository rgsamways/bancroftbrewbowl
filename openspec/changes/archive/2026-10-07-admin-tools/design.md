## Context

See proposal.md. `requireAdmin` checks `session.user.isAdmin`. The scripts `seed-schedule`, `make-admin` and `reset-password` do the work today. `docs/ROLES_AND_RULES.md` listed these as operator-only; Robin has now said his account is the god-user, as in his other projects.

## Goals / Non-Goals

**Goals:** one account that can do everything and alone does site setup; screens for the three setup jobs; a fairness model that the god-user cannot bypass.

**Non-Goals:** a general roles screen (slice 14); giving Lark or other admins any setup screen; temporary passwords; changing how ordinary admins work.

## Decisions

- **The god-user is configuration, not data.** `OPERATOR_EMAILS` (comma-separated, case-insensitive) in the server environment. An account is the god-user when its **verified** email is in that list. Sign-in by emailed link verifies the email, so only someone who controls the inbox qualifies. No column, no screen, no way to grant it from inside the app; changing it is a Railway variable change. If the god-user changes their account email, they lose the status until the variable is updated (noted on the Me page for that account).
- **God-user passes every admin check.** `requireAdmin` accepts `isAdmin` or god-user; a new `requireOperator` accepts only the god-user. The session summary the dashboard reads carries `isOperator` so the Admin tab and More show the right things.
- **Fairness rules are not permissions, so they hold for the god-user:** other players' picks stay hidden until their reveal time (admins see only "picked"), nobody can change another player's pick, locks are never overridden, and a decision that changes the god-user's own entry still needs another admin to confirm (a sole admin keeps today's recorded fallback).
- **Schedule load.** A route reads ESPN weeks 1 to 18 for the chosen season with the shared reader, compares with our games, and returns a preview: games to add, games whose kickoff differs. Apply inserts new games as undecided and updates kickoffs of games that have not started; it never sets or changes a result and never touches a started game. Results keep coming only through Check for results, which scores them. Needs the preview-then-confirm shape and an Activity record.
- **Admins.** Add by email looks up an existing account and sets its admin flag; with no account it says "They need to sign in once first" (an invitation table is a later step). Remove clears the flag. Refused: removing the last admin, and removing an account that is a god-user. One Activity record per change, naming who did it.
- **Help someone sign in.** Reuses the logic of `reset-password`: delete the player's sessions and remove their credential password. Safe because the player can still sign in with an emailed link; no secret is created or shown. Refused for the god-user's own account (use the normal Me page).
- **Scripts stay** as a developer backup; their logic moves into shared library functions so the screen and the script cannot drift.
- **Tests and the god-user:** the e2e API gets `OPERATOR_EMAILS` set to one fixed test address, so tests can sign in as the god-user without touching the real list.

## Risks / Trade-offs

- A single email decides the highest level. Mitigation: verified email only, the variable lives in Railway, and every setup action is recorded in Activity.
- Loading a schedule on a running pool changes kickoff times that locks depend on; the preview shows exactly what changes, and started games are never touched.
- The god-user is also a player in the pool (Robin). The fairness rules above are the answer, and are tested for the god-user specifically.
