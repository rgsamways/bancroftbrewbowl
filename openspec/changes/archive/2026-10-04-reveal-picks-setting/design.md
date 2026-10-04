## Context

See proposal.md. `visiblePicks` (`lib/pick-visibility.ts`) already takes a set of "locked weeks" and shows other people's picks only for those; `getLockedWeeks` (`lib/pick-lock.ts`) supplies it from kickoff times. Pool rules are JSON on `pools.rules`, validated by the rules schemas.

## Goals / Non-Goals

**Goals:** one new rule, one place that computes which weeks are "revealed", and everything that shows other people's picks (the picks routes, TV most picked) uses it.

**Non-Goals:** per-game visibility; changing when picking locks (still the first kickoff); a setting that can change mid-season.

## Decisions

- **Reuse the existing function shape.** Add `getRevealedWeeks(seasonYear, rule, now)`: for `at_lock` it returns `getLockedWeeks`; for `after_final_game` it returns the locked weeks where no game is still pending. `visiblePicks` is untouched, so its existing tests still prove the privacy rules.
- **"Final" = every game of the week has a result other than pending** (win, loss or tie). Same definition the app already uses for a decided week.
- **Default `at_lock` when the key is missing,** so existing pools keep today's behaviour with no data change. The schema default covers new pools; readers use `rules.reveal_picks ?? "at_lock"` for old rows.
- **Locks with the other rules.** Changing it mid-season could reveal or hide picks people relied on; the existing "locked pool refuses rule changes" server rule covers it for free.
- **Admins get no extra view.** Before the reveal an admin still sees "picked" only; own picks are always visible.
- **TV and counts follow the same rule.** `pickCounts` takes the revealed state instead of just the lock time; the TV placeholder says "Shown when the week's games are final".
- **An option, not a fairness change:** Robin's view is that waiting to see others' picks gives no advantage.

## Risks / Trade-offs

- A week with a game that never gets a result (postponed, admin forgets) keeps picks hidden. The admin Next step already asks for results; acceptable.
- Under `after_final_game` players see nothing of others' picks all weekend; the Settings copy explains it so nobody is surprised.
