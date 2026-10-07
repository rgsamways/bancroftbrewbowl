## Context

See proposal.md. The ESPN reader (`lib/espn.ts`) already fetches a week's scoreboard (`scoreboard?seasontype=2&week=N&dates=YEAR`) and keeps only result, scores and kickoff. The same payload carries `status.type.state` (`pre`, `in`, `post`), `status.type.shortDetail` ("Q3 4:21", "Halftime", "Final/OT", "Postponed"), `status.displayClock` and `period`, each team's `records`, `broadcasts`, and `week.teamsOnBye`. It also carries odds, logos and weather, which we do not use.

## Goals / Non-Goals

**Goals:** a scoreboard that feels alive on Home without hammering ESPN or the player's data plan; own picks marked; failure never visible as an error.

**Non-Goals:** odds or spreads; ESPN logos; player stats or play-by-play (a later slice, for games); the playoffs (a separate plan, they use another ESPN season type); a TV-page scoreboard; push notifications.

## Decisions

- **One cached feed for everyone.** `lib/scoreboard.ts` holds the last good scoreboard for the current week in memory. Time to live: about 20 seconds when any game is live, about a minute when a game starts within half an hour, ten minutes otherwise. One fetch at a time (concurrent requests share it). On an ESPN error the last good answer is served for up to an hour, marked `stale` with its `asOf`; after that, no scoreboard. Railway runs one API process, so an in-memory cache is enough; if that ever changes, the cache is the single place to swap.
- **Which week:** the current week by our own rule (first week with an undecided game, `entry-state.ts`), and the latest season that has games, so Home and the scoreboard never disagree. A season that is over, or no games, means no scoreboard.
- **Own picks only.** The endpoint also returns, for the signed-in player's alive entries, the teams they picked this week (their own picks are always theirs to see). No one else's pick, name or count goes into this answer. Pool names are shown only when the player is in several pools.
- **The reader grows, it does not fork.** `parseEspnEvents` gains optional live fields (state, status text, clock, period, records, network, bye teams) so results, the schedule loader and the scoreboard all read ESPN the same way. Status names for delays, postponements and cancellations are mapped to plain words.
- **Polling, not live connections.** The Home section refreshes every 30 seconds while any game is live and every 5 minutes otherwise, pauses while the tab is hidden, and refreshes when the tab comes back. With the server cache, 100 phones cost ESPN about three requests a minute.
- **Placement and size.** Under the hero, above "At the brewery", as compact one-line-per-game rows (live first, then upcoming by kickoff, then final), with "Show all" past the first six so Home stays short. Team colour circles come from the existing `TEAM_COLORS`.
- **No odds, no logos.** The odds fields are never read or sent; logos would mean hot-linking ESPN images and their usage terms.
- **The ESPN feed is unofficial and can lag.** The section says when it was updated and that scores can lag a little. Nothing in the app decides a pick or a result from this feed; results still go through Check for results.

## Risks / Trade-offs

- ESPN's JSON may change; the parser is defensive (unknown fields are ignored, an unreadable event is skipped) and the whole section is optional.
- In-memory cache resets on every deploy; the first request after a deploy simply refetches.
- Live scores are a few seconds behind the TV; acceptable for a scoreboard, and the reason this is not used to lock picks.
