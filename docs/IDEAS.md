# Ideas parking lot

Ideas Robin has had that are **not** planned or started. Nothing here is a commitment. Don't begin any of these unprompted (see the Pace section of `CLAUDE.md`); when Robin picks one up, start with `openspec-explore`, then a mockup, then a real OpenSpec change.

## In-brewery games (noted 2026-10-04)

Robin's idea: create some **fun little games people can play with each other while watching a game, sitting at the brewery.**

That's all that has been said so far. There is no design, no scope and no decision yet about what the games are, whether they live inside Brew Bowl or beside it, or who plays whom.

Keep in mind when this is picked up:

- It fits the v2 purpose: get people to the brewery, playing on their phones, together. Phone-first and quick in a loud room.
- The legal guardrails in `docs/v2/V2_PLAN.md` apply to anything new: no money, no alcohol tied to playing or winning, no purchase needed, bragging rights only.
- The tone should match the polished, modern look (no sound or motion for now unless Robin changes that).

Questions to ask Robin when it's time (mine, not his):

- What kinds of games does he picture: quick predictions during a game, head to head with the person next to you, table against table, something else?
- Does it need to work while the NFL game is on, or any time?
- Do players need an account, or can people join by scanning a code at the table?
- Does anything about it affect the pools, or is it completely separate?

## Staff "show the QR" page (noted 2026-10-04)

Robin's idea: a page staff can open on their phone with a QR code, so when a guest has nothing handy to scan, a server can say "no problem, scan this to check in for the week."

My take (Option A, recommended): a full-screen page with a big QR, the address in text, and "Scan to make your picks for week N". It opens the app, signs the guest in if needed and lands on the current week's pick (existing players) or the join page (new people). One stable QR is enough because the Pick screen already shows the current week. Draw it in the browser like the table card (`qrcode`), so it works without Wi-Fi. No schema change; any signed-in user can open it, so no new permission. A short session.

## Weekly in-person check-in (noted 2026-10-04)

Robin's idea: **cycle the QR code every week**, so players have to come to the brewery at least once a week. It cuts down on people playing from home and brings people in.

Things to settle before building:

- **A shared photo defeats a weekly code.** To prove presence the code must be short-lived: shown from a staff phone, or rotating every few minutes on the TV. Still a deterrent, not a guarantee.
- **People who can't come.** Weeks lock at the first kickoff (often Thursday night), so the window is short. Needs a fallback: staff or an admin checks someone in by hand, or an admin excuses a player for the week, both recorded in Activity.
- **What happens if you don't check in?** Today a missed pick costs nothing: scoring only eliminates on a losing pick, so a player who never picks stays alive. Decide whether no check-in just means you can't pick, or means you're out. "No pick means out" is its own decision and also affects the late-start plan.
- **Legal.** Requiring a visit to the licensed premises to take part in a pool with a cash pot could count as a condition of entry. Put it on the same list as the drink-offer wording for the owner and AGCO. Not legal advice.
- **If built:** a per-pool setting "Require in-person check-in each week" (off by default); a rotating code; a small new `check_ins` table (schema change: plan it first and migrate on staging first); picking requires a check-in for that week; a staff "check in manually" action. A rule like `check_in_player` would join the staff roles in `docs/ROLES_AND_RULES.md`.

Questions for Robin and the owner: if someone doesn't check in, can they simply not pick, or are they eliminated? Should the TV show the rotating code, or only staff phones? Does the owner want it at all?

## Staff roles (noted 2026-10-04)

The owner and his wife will likely want to hand duties to wait staff and other employees. The proposed rules, roles (bar staff, kitchen, game-night lead, events and marketing, menu manager, pool manager, general manager, owner or admin, read-only auditor), safeguards and questions for the owner are written up in `docs/ROLES_AND_RULES.md` under "Staff and employee roles". That is slice 14 (optional) in `docs/v2/V2_BUILD_PLAN.md`.

## Small fix (done 2026-10-04)
(Fixed: the header now uses the same width and padding as the page.)


The top bar (`AppHeader.tsx`) is `max-w-3xl` with 16px side padding while the page content is `max-w-lg` with 24px, so on a phone the logo and avatar sit closer to the edges than the cards, and on a wide window the bar is wider than the content. One-line fix: match the content width and padding.

## Per-game picks: wait until your game starts (noted 2026-10-04)

Robin's point: people may want to wait until the game they want to pick starts to be decided (or kicks off) instead of locking in before the Thursday game. Today a whole week locks at its first kickoff, so a Thursday game locks every pick for the week.

The setting already exists but does nothing: pool settings list a `per_game_kickoff` deadline rule, and no server code reads it (`docs/BUILD_PLAN.md` "Known gaps"; `apps/api/src/lib/pick-lock.ts` is the one place that decides today's rule). Special NFL-schedule handling would be needed. Things to think through when it is picked up:

- **The lock moves from the week to the game.** A pick for a team locks at that team's kickoff, not the week's first kickoff. Thursday, Sunday early and late, Sunday night, Monday night, and later-season Saturday games and holiday games all lock separately.
- **Survivor:** you can still choose any team whose game hasn't started. Open question: can you change a pick after an earlier game has started? For example, picked a Sunday team, the Thursday game ended and you'd have liked it. Likely rule: a pick can change until the kickoff of the game it is for, but you can't switch to a team whose game has already started. Double-pick weeks need a rule per pick.
- **Pick 'em** is simpler: one pick per game, each locking at its own kickoff.
- **Privacy:** Robin's view (2026-10-04): there is **no advantage to waiting for a late game while seeing what other players picked**, for either pool type, because you still have to be right. So the "picks stay hidden until the week locks" rule (`lib/pick-visibility.ts`, `lib/pick-counts.ts`) can stay as it is and doesn't need a per-game version; the TV most-picked list and the recap keep using the week's lock. (Revisit if the owner disagrees.)
- **Home, Pick and the admin Next step** all use one definition of the current week and its lock time (`lib/entry-state.ts`). That would need a per-game version: countdown to the next lock, "locked" being partial, and "needs picks" meaning no unstarted game is picked.
- **Flexed games.** The NFL moves kickoffs (flex scheduling, rescheduled games). Lock times must read the stored kickoff each time; the seed script (`pnpm seed-schedule`) refreshes them, but a late move after someone relied on it needs a rule.
- **Fairness:** the early-information worry is settled by the point above. The existing "another admin confirms" rule and Activity stay for admins who also play.
- **It changes the game a little.** Waiting for a late game lets you use news (injuries, line moves) that early lockers don't have. Robin doesn't see that as a problem; the owner should still agree. A middle option: the week locks at the first Sunday kickoff, with Thursday games as their own separate pick.
- Needs a plan-mode design pass (it touches picks, visibility, scoring-adjacent rules, and likely the setting's meaning), and its tests must cover every game-day pattern: Thursday, Sunday, Monday, a flexed game, a bye team.
