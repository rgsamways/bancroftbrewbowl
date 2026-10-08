## Context

`components/Scoreboard.tsx` builds a map from team code to the list of pool names it was picked in (`pickPools`) and shows "Your pick · <names>" when the player is in several pools. The API already sends `yourPicks` per pool, so the count is the length of that list. See proposal.md.

## Goals / Non-Goals

**Goals:** a one-line row per team, with a marker that works for any number of pools.

**Non-Goals:** a more compact game layout (separate idea); any API change; showing pool names anywhere on the scoreboard.

## Decisions

- **Chip text is fixed-length.** "Your pick" or "Your pick ×N": it cannot grow with pool-name length, so the team name keeps its room. The chip does not shrink (`flex-none`) and the name keeps `truncate` only as a last resort on very narrow screens.
- **Tint on the row, not the card.** The row gets a faint accent background and rounded corners, so a game where the player picked one team is clear at a glance, without shading both teams.
- **Pool names dropped.** They are on the pick screens. Alternative considered: a tap-to-expand for pool names; rejected as extra interaction for little value.
- **Chip is decorative text for sighted users, with a readable label for assistive tech:** the row's accessible text keeps "Your pick" (and the count), so the existing test selectors keep working.

## Risks / Trade-offs

- A player can no longer see on Home which pool a pick belongs to → the pick screens and Standings show it, and the count tells them it is more than one.
