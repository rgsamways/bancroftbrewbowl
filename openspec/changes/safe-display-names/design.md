## Context

See proposal.md. better-auth creates an account with the email as its name until the player changes it on the Me page. `routes/standings.ts`, `tv.ts` and `home.ts` each build a player's name as `user.name ?? invitedName ?? "A player"`, so the email goes straight out.

## Goals / Non-Goals

**Goals:** no email-shaped name on any player-facing screen; a gentle nudge to set a real name.

**Non-Goals:** changing admin screens; rewriting stored names; forcing a name before joining (a nudge, not a gate).

## Decisions

- **Fix at the server, with one helper.** `publicName(name, invitedName)` in `@bbb/shared` is the only place that decides. Screens can't leak because they never receive the raw name.
- **Use the part before the "@".** Two unnamed players stay distinguishable ("larkpopowicz"), at the cost of showing part of an address. The nudge makes this rare. The alternative, "A player" for everyone, hides too much in a pool of friends. Easy to change in the one helper.
- **A card on Home, not a gate on joining.** It covers existing players (like Lark) and new ones in one place, and nobody is blocked from playing. Saves with the same call as the Me page.
- **Stored names are not rewritten.** The helper handles old data, and the player's own Me page still shows what they typed.

## Risks / Trade-offs

- A real name that contains an "@" (very rare) would be shortened; accepted.
- Part of an address is still shown until the player sets a name.
