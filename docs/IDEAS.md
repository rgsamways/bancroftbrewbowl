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

## Small fix to do when asked

The top bar (`AppHeader.tsx`) is `max-w-3xl` with 16px side padding while the page content is `max-w-lg` with 24px, so on a phone the logo and avatar sit closer to the edges than the cards, and on a wide window the bar is wider than the content. One-line fix: match the content width and padding.
