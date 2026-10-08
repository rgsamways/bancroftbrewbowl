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

**Moved up and planned 2026-10-07: `openspec/changes/per-game-pick-locking`** (Robin: players should be able to pick right up until game time). Decisions: other players' picks show as each game starts; a pool setting, per-game for new pools. Waiting for his go.

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

## "Update results from ESPN" button (noted 2026-10-04)

Robin's idea: let the owner, his wife or whoever has permission run a weekly "update the pools" step instead of entering scores and outcomes by hand.

Shape I'd suggest: a button on the admin Results screen. It fetches finished games from ESPN (reusing the logic in `apps/api/scripts/seed-schedule.ts`), shows a preview ("6 games finished since last time: ..."), and applies only on Confirm. Applying scores each game the same way hand-entered results are scored today (`lib/scoring.ts`: eliminations, mulligans, wipeouts held for an admin), so it is not the same as the schedule script, which writes results without scoring. It only fills games that are still pending, never overwrites a result an admin entered, and flags disagreements. Each use is one Activity record under the admin's name. Stays a button (the project has no scheduled jobs by design). A rule like `import_results` would join the staff rules in `docs/ROLES_AND_RULES.md`. Risk: ESPN's endpoint is public but unofficial, so keep the manual Results screens as the backup. The same button could do the late-start catch-up. No schema change expected.

## Sleeper and individual-player pools (noted 2026-10-04)

Robin's question: what could we do with Sleeper (the fantasy football app) if we decide to venture into pools about individual players, not just teams?

What Sleeper's public API gives (docs.sleeper.com, checked 2026-10-04): read-only, no sign-in. Users, leagues, rosters, weekly matchups, drafts and draft picks, transactions, playoff brackets, a full NFL player database (about 5 MB), trending players, and an "NFL state" call (current season and week). Limits: stay under 1,000 calls a minute; download the player list at most once a day and cache it; attribution is required when showing trending data. **It is free for non-commercial use only; commercial use needs a licence from Sleeper.** A brewery's app that draws customers is arguably commercial, so ask Sleeper before building on it. Game scores and per-player stats are not in the documented API.

Ideas, roughly from least to most work:

1. **Bar fantasy-league board (read-only).** An admin pastes a Sleeper league id; the TV page and a screen show that league's standings and this week's matchups for the people who play at the brewery. No new pool type, no player data of our own, no scoring. Needs only league, users, rosters and matchups.
2. **Player picker for a new kind of pool.** Use the cached Sleeper player list (name, position, team, injury status) as the "teams" list in a pool where each week you pick a player instead of a team. Examples: a survivor pool on players (pick a quarterback whose team wins), an anytime-touchdown pick, "who scores more fantasy points" head-to-heads. The picker, privacy and lock rules we already have would carry over. The hard part is results: we would need per-player stats, which Sleeper does not document, so ESPN's box scores (unofficial) or a paid stats feed would be the source.
3. **Two-sided link.** Let a player link their Sleeper username so Brew Bowl can show their fantasy team next to their name. Only worthwhile if people ask.

Cautions: fantasy contests with prizes are regulated differently from a team pool in Ontario, so any player-based pool with a prize needs the owner's and AGCO's view, the same as the drink-offer wording. Keep money out of the app, as now. `pools.type` is immutable and the scoring engine is built around teams and games, so player pools mean a third pool type and a new scoring path, which is a plan-mode design pass of its own. Do not start before the ESPN results button (`openspec/changes/espn-results-button`) is done, because player pools would reuse its results reader.

## Invite players, and test the whole first-time journey (noted 2026-10-07)

Robin's idea: a way for players to invite one or more other players, especially this season because the pool started late.

- **Invites.** A player (or admin) enters one or more email addresses, or shares a link, and the people invited can sign in and land straight in a pool, ideally with the pool already chosen in the invite so there is no hunting for it. Open questions to settle before planning: who may invite (any player, or admins only), how many at a time, whether the invite sends an email (Resend is set up on production only) or just gives a share link, rate limits so it cannot be used to spam, whether the inviter sees who accepted, and what the invited person is called before they set a display name. Admins can already add a player by email (`PlayersTab`, `invitedName` on entries), so this builds on that.
- **A full first-time test.** One browser test that runs the whole story as a brand-new person: receive the invite, open the link, sign in, set a display name, join the pool, make a pick, and see it saved. Also a variant for a late joiner (weeks 1 to 4 already a free pass). The goal is to be certain none of it can fail on launch day. The existing `e2e/join-and-pick.spec.ts` and `e2e/sign-in.spec.ts` cover pieces of this but start from an already signed-in player.
- **The TV "Play on your phone" code.** Today it encodes the site's home address, which sends a new person to the sign-in page and then to Home, not straight into a pool. Test scanning it as someone who has never played (a fresh browser, no session), and consider a code that carries the pool (`/join/:poolId`) so a first-timer lands on the join step. A "different code" for this is fine if it reads better.
- Not started. Would need an OpenSpec change and a plan-mode design pass; any invite table or token is a schema change.

## Soften the signed-out front page (noted 2026-10-07)

Robin's thought: when someone who is not signed in opens the site, the page is almost entirely "Sign in to play" (`pages/Login.tsx`, shown for every address except `/menu*` and `/tv/*`). It could be softer, and could show other things a casual visitor might want to see before committing to the signed-in side: what the pool is and how it works, the menu and what is on tap, live music and the calendar, the brewery's location and hours (the location map idea), maybe a glimpse of this week's standings or the scoreboard. Keep sign-in one tap away, not hidden. Open questions: which things are public (menu, music and the future calendar already are; standings and pool names are not), whether the table QR (`/menu`) and the TV QR (home page) should land somewhere different, and how this ties to the invite flow and the first-time-player journey noted above. Not started; needs a design pass and the owner's view on what to show strangers.

## Rethink the bottom navigation (noted 2026-10-07, start of next session)

Robin's idea: the player tabs are Home | Pick | Standings | Menu | (Admin) today. Evolve them to Home | Games | Menu | Admin, where the Games tab has its own sub-tabs, the way Menu has Drinks, Kitchen, Music and Calendar: **Games** (the in-brewery games above), **Pools** (Survivor and Pick 'Em), **Leagues** (fantasy leagues, eventually). A pool then gets its own tabs: **Pick | Standings | Stats**.

My view: the structure is right and gives every later feature a home. Watch the cost: Pick and Standings are the weekly habit and are one tap today, so keep Home's hero as the shortcut to the pick screen and remember the last pool and sub-tab. "Games" is ambiguous (NFL games, brewery games, pools); "Play" may read better. Do not show a sub-tab until it has content (Games and Leagues are empty today), so Pools would show alone at first. Stats is undecided (team usage, pick percentages, history). The Menu tab could stay or grow into something broader. It touches `lib/tabs.ts`, the routes in `App.tsx`, `BottomTabs`, `PoolTabs` and most browser specs, so plan it first as its own change. Not started.

## A People screen: everyone with an account, plus pending invites (noted 2026-10-07)

Robin asked whether there is anywhere to see all users including pending invites. Today there is not. What exists: each pool's Players tab lists that pool's entries, with an "Invited" mark for a person an admin added by email who has not signed in yet; Site setup > Admins lists only the admins; Site setup > Help someone sign in finds one account by exact email. Not visible anywhere: an account that signed in but never joined a pool, and anyone invited by a share link (by design there is no invite record, so nothing to list).

Proposal: **More > People** under Site setup (site owner only, because it shows emails): every account with name, email, when it was created, the pools it is in, an admin mark and a "no pool yet" mark, search, plus the admin-added invites that have not signed in yet. Optionally a count of players per pool. Read-only, no schema change, no new records. It could also carry the "Help someone sign in" action per row, replacing the exact-email lookup. Not started; plan it with `openspec-propose` and wait for Robin's go.
