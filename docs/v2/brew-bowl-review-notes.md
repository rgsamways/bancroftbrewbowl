# Brew Bowl — Review Notes

## Home
- Homepage feels bland. Should probably show an NFL scoreboard at least.

## Pick
- Felt a little sexier with the team color circles from the mockups. Perhaps add those back.

## Standings
- Could be shown a few different ways for more interesting viewing.
- Some survivor sites show a matrix of the teams each player took each week.

## Menu
- Guess the color of each drink on their menu and add a color circle beside each one matching that color.
- Lark is keen on product placement, so eventually each drink/meal she lists in the menu will need a picture upload.

## Admin — Results
- When an admin sets a game result, pull the final score of that game from ESPN. Alternative is putting the score-entry functionality back in, but pulling it probably makes more sense.

## Admin — Menu
- Bug: when the Music tab is tapped, two tabs show as selected (Drinks and Music both highlighted).

## General
- Ensure each page scrolls to the top on load. They currently look like they open scrolled down by the height of the top nav bar.
- Add as much NFL content as we can scrape from ESPN or other sources. If any source provides up-to-the-minute data, use it to add exciting features throughout the app.

## Games
Little games people can play on their phones while watching the game at the brewery.

- Must start planning playoff season games now so we're ready when it rolls around.

### Head-to-head Concentration (NFL teams)
- Classic concentration/memory game where the cards are NFL teams.
- 2 players begin a session together; a timer counts down from 5 to start.
- One player gets 32 cards (2 for each of the 16 AFC teams), the other gets 32 for the NFC.
- Each player plays their own board.
- Session viewable on a larger screen by others, showing both players' boards side by side, refreshing every 5–10 seconds.

### Connect Four (team colors)
- Each player's chips are color circles for their favorite team.
- Run it as a session so others can watch as well.

### Player Rank Movement (if ESPN provides the data directly)
- Every Tuesday, after the week's games are done, scrape a rankings list of real players based on an agreed-upon scoring system for the stats they put up (season totals).
- Players pick a player and guess whether he'll move up or down in the rankings. Points = number of spots moved.
  - Example: Jonathan Taylor is 5th last week, 3rd this week. Guessed up → +2. If he dropped to 7th → −2.
- You can pick both ways. A pessimist can guess a player goes down and win the spots he drops — but lose them if he goes up.
- Knowledge pays off:
  - Saquon Barkley injured and missing the next game while neck and neck with 6 other RBs → could drop 6+ spots.
  - A rookie about to start his first game could shoot up 10–15 spots in one week.
- Edge cases:
  - Week 1 of a new season: rankings based on final results from the previous season.
  - Retired players: ineligible or fair game, depending on the league.
- Pool sizes differ by position (many more WRs than QBs/TEs), so how many players per position are eligible (e.g. top 32 QB/TE, top 50 RB, top 75 WR) should be a per-pool setting agreed on by each pool.
- What matters for every player, regardless of position or availability: movement up or down compared to fellow athletes at the same position. Points are simply the number of spots moved from the previous week.

### More game ideas (suggested by Claude)
Quick to understand, short rounds, and built to keep people coming back.

- **Game-day Bingo** — each player gets a random card of in-game events (fumble, challenge flag, 4th-down conversion, 50+ yd field goal). Squares auto-mark from live data where possible. Everyone in the room is playing the same game at once.
- **Next Play** — during a live game, predict the next play: run, pass, punt, field goal. Points for correct calls, live leaderboard on the TV. Lives entirely off the up-to-the-minute data.
- **Drive Call** — before each drive, predict how it ends: TD, FG, punt, turnover. Slower-paced version of Next Play for people who are also eating and talking.
- **Squares** — the classic bar football squares grid tied to the last digit of each team's score by quarter, filled automatically from live scores. Play for bragging rights or house prizes, not money.
- **Guess the Player** — daily Wordle-style puzzle: guess the mystery NFL player in 6 tries, with hints on team, division, position, jersey number, age. One per day keeps people returning.
- **Logo Reveal** — a team logo starts pixelated or zoomed in and sharpens; first to tap the right team wins the round. Works head-to-head and watchable on the TV.
- **Colour Match** — flash a team's colour pair, pick the team from four options against the clock. Reuses the team colour circles.
- **Higher or Lower** — two players or teams with a stat (career TDs, wins this season); guess which is higher and keep the streak going. Personal best streak on a leaderboard.
- **Division Sort** — drag all 32 teams into their 8 divisions as fast as possible. Fastest time of the night goes on the TV.
- **Field Goal Kicker** — one-tap timing game: stop the meter for accuracy and power, distance grows each make, wind changes. Longest kick of the night wins.
- **Trivia Blitz** — head-to-head, 10 quick NFL questions in 60 seconds, watchable on the big screen.

### Follow-up discussion

**Game-day Bingo**
- Robin: sounds amazing, but would need a lot of attention and likely someone to be the shot caller as the game progresses. Would be a big hit if it draws data automatically.
- Auto-marking: ESPN play-by-play tags fumbles, interceptions, sacks, penalties, challenges, field goal distances. Build cards only from events the feed reliably reports; leave out anything subjective.
- Alternative: players self-mark (honour system), verified against the feed only when someone calls bingo.
- Test the live feed's speed and completeness before committing.

**Next Play**
- Would also be fed by ESPN, but the feed is unofficial and posts plays some seconds after they happen.
- Problem: picks must lock before the snap, but the feed only reports plays after. If the feed lags the TV, people could pick after seeing the play.
- Possible workaround: close picks a set number of seconds after the previous play posts. Needs testing against the TV at the brewery.
- Drive Call has the same issue on a smaller scale and may be the more reliable of the two.

**Squares** (Robin: obvious hit if done well; add twists)
- Every score wins, not just quarter ends.
- "You're close" glow when a square is one score away.
- Reshuffle numbers each quarter so nobody's stuck with a dead square.
- Long-shot bonus: rare combos (2s, 5s) pay double.
- Reverse winner: smaller prize for flipped digits.
- Menu tie-in: winning squares get a menu item, photo shown on TV (fits Lark's product placement). Lark to confirm what's allowed for alcohol prizes.

**Field Goal Kicker — sensitivity starting points**
- Anticipation timing, not reaction: most people land within ~30–50 ms of a predictable target.
- Meter sweep ~1–1.5 s.
- Sweet spot ~80–100 ms wide for short kicks, shrinking to ~25–35 ms at 55+ yards. Wind can shift the target.
- Phone touch latency varies by device (50+ ms); judge taps by the tap event's own timestamp for a fair leaderboard.
- Tune by playtesting at the brewery until about half of players miss at 50 yards.
