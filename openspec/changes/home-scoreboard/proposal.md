## Why

Home is bland: the hero and "At the brewery" and nothing about the games people are watching. Robin wants an NFL scoreboard on Home, and more up-to-the-minute NFL content after it. ESPN's public scoreboard already gives live scores, clock and quarter, records, TV network and byes for every game.

## What Changes

- A **scoreboard on Home**, under the hero: this week's games, live ones first, with the score, quarter and clock; upcoming games with kickoff time and TV network; finished games with the final score. Team colour circles (our own), records, and the teams on a bye.
- The player's **own picks** are marked on the games ("Your pick"), so they can follow how their week is going. Only their own picks, never anyone else's.
- A new **cached server feed** (`GET /me/scoreboard`) that reads ESPN once for everyone: short cache while games are live, long when nothing is on, one shared request at a time, and the last good answer is kept if ESPN hiccups. Many phones in the brewery never mean many requests to ESPN.
- The screen **refreshes itself**: about every 30 seconds while a game is live, every few minutes otherwise, and not at all while the tab is hidden.
- If ESPN has nothing or fails, the scoreboard simply isn't shown (or shows the last good answer marked "as of"). Home never shows an error for it.
- **Left out on purpose:** betting odds and spreads (the app keeps gambling content out), ESPN's logos (we use our own team colours), and anything about other players. The playoffs, the TV page and a full scoreboard page are later.
- No schema change.

## Capabilities

### New Capabilities
- `nfl-scoreboard`: the shared, cached scoreboard feed and its rules.

### Modified Capabilities
- `home`: the scoreboard section.

## Impact

- API: `lib/espn.ts` (parse live status, clock, records, network, byes), new `lib/scoreboard.ts` (cache, single flight, stale on error) and `GET /me/scoreboard` (in the home routes).
- Shared: scoreboard types.
- Dashboard: a Scoreboard section on Home with its refresh timer; team circles reused from the Pick screen.
- Tests: parsing of every game status, cache timing and failure behaviour, the route (signed out, own picks only), and Home in the browser against the ESPN stand-in (live, upcoming, final, bye, ESPN down).
