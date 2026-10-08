## Why

On Home's scoreboard, a team the player picked carries a badge that lists every pool it was picked in ("Your pick · The Bancroft Brewery Survivor Pool, Weekly Pick 'Em Pool"). Pool names are long, so the badge squeezed the team name, and moving it to its own line made every picked row taller and noisier. Robin wants a calm marker that works with any number of pools.

## What Changes

- A team the player picked gets a subtle accent tint on its row and a small chip next to the name: "Your pick", or "Your pick ×2" (×N) when the same team was picked in more than one pool.
- Pool names are no longer shown on the scoreboard. Which pool a pick belongs to stays on the pick screens.
- Rows stay one line high; the team name is never shortened by the chip.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `home`: "Home shows the NFL scoreboard" changes how the player's own picks are marked.

## Impact

- Dashboard only: `components/Scoreboard.tsx`. The scoreboard API already sends which pools each pick is in, and keeps doing so (the count is derived from it). No schema or API change.
- `e2e/scoreboard.spec.ts` (the "Your pick" assertions), plus a case for a team picked in two pools.
