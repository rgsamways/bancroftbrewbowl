import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/client.js";
import { games } from "../src/db/schema.js";
import { fetchEspnEvents, parseEspnEvents } from "../src/lib/espn.js";

const seasonYear = Number(process.argv[2] ?? new Date().getFullYear());

// Regular season only — preseason games aren't picked in a survivor pool and
// would collide with regular-season week numbers in our schema. Games are
// shared across every pool running this season (see schema.ts), so this
// only needs to run once per season, not once per pool. Safe to re-run: an
// existing game is updated in place (picks up new/changed scores/results)
// rather than skipped, so this also works to backfill historical seasons.
// This writes results straight to the games WITHOUT scoring any picks; the admin
// "Check for results" button is the way to apply and score results.
for (let week = 1; week <= 18; week++) {
  const events = await fetchEspnEvents(seasonYear, week);
  if (events.length === 0) {
    console.log(`Week ${week}: no games found from ESPN, skipping`);
    continue;
  }

  const parsed = parseEspnEvents(events, week);
  for (const name of parsed.skipped) console.warn(`  Week ${week}: unrecognized matchup "${name}", skipping`);

  let imported = 0;
  let updated = 0;

  for (const game of parsed.games) {
    const { homeTeam, awayTeam, result, homeScore, awayScore } = game;
    const kickoffTime = game.kickoff;

    const existing = await db.query.games.findFirst({
      where: and(
        eq(games.seasonYear, seasonYear),
        eq(games.weekNumber, week),
        eq(games.homeTeam, homeTeam),
        eq(games.awayTeam, awayTeam)
      ),
    });

    if (existing) {
      await db
        .update(games)
        .set({ kickoffTime, result, homeScore, awayScore })
        .where(eq(games.id, existing.id));
      updated++;
      continue;
    }

    await db
      .insert(games)
      .values({ seasonYear, weekNumber: week, homeTeam, awayTeam, kickoffTime, result, homeScore, awayScore });
    imported++;
  }

  console.log(`Week ${week}: imported ${imported}, updated ${updated}`);
}

console.log("Done.");
process.exit(0);
