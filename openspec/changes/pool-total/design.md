## Context

`pools` has `rules` (jsonb), `status` and the usual columns; the admin `PATCH /pools/:id` already updates name, season, status and rules and does not itself block edits when a pool is not a draft (the "locked" look is only in the dashboard form). `GET /pools/:id` needs no sign-in today, and Standings (`PoolStandings.tsx`) reads it. The step-by-step admin and the full Standings redesign are later slices, so this change adds to the pages as they are. See proposal.md for why.

## Goals / Non-Goals

**Goals:**
- One number, typed by an admin, shown on Standings with the chosen wording (option B in `pot-options.html`).
- Additive schema only.

**Non-Goals:**
- Any money handling, per-player amounts, or calculating the total.
- Restyling Standings or the admin settings beyond adding the card and field.
- Logging who changed the total (the activity log is slice 8).

## Decisions

- **A real column, not a rules key.** `pools.pool_total_cents integer null`. The total is not a game rule, must stay editable when rules are locked, and a typed column is easy to validate and read. Alternative: a key inside the `rules` jsonb. Rejected: it mixes display data into scoring rules and would be swept up by the rules validation that rejects unknown keys.
- **Cents as an integer, dollars in the UI.** Avoids floating-point money; the UI accepts "320" or "320.50" and displays whole dollars when there are no cents. Alternative: numeric/decimal column. Rejected as heavier than needed for a display number.
- **Reuse the existing admin update route.** `PATCH /pools/:id` gains `pool_total_cents` (integer 0 to 100,000,000, or `null` to clear). It already requires an admin and does not look at status, which gives "any time, even locked" for free; a test pins that behavior so a later lock rule cannot silently break it. Alternative: a dedicated `/pools/:id/total` route. Rejected: more surface for no gain.
- **Shared helpers parse and format.** A small `pool-total.ts` in `@bbb/shared` turns the typed text into cents (or a plain message) and cents into "$320" / "$320.50", used by the field and the card so they agree.
- **Separate form in settings.** The admin settings keep their locked form; "Pool total" is its own small form with its own Save button, so it works while the rest is read-only.
- **Public read.** The total comes back on the same `GET /pools/:id` Standings already calls. That route needs no sign-in today, so the total is readable without one. It is a number the brewery wants players to see and carries no personal data, so this is accepted and not changed here.

## Risks / Trade-offs

- [Schema change runs unattended on deploy] → additive nullable column, verified on a local database and called out before the push; revert needs no rollback.
- [Someone reads the total as the app handling money] → fixed wording on the card, and nothing in the product computes or moves money.
- [A later lock rule could block edits to a locked pool] → test asserts the total can be changed on an active pool.
- [Standings is redesigned next] → the card is a small self-contained component that slice 7 can move.

## Migration Plan

1. `pnpm db:generate` creates a migration with a single `ALTER TABLE pools ADD COLUMN pool_total_cents integer`.
2. Verify it on the local Docker database, then on staging's separate database, before production.
3. Push to `staging`, check, promote to `main`; Railway's `preDeploy` migrates production.
4. Rollback: revert the commit. The unused column is harmless.
