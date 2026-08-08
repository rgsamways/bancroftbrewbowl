import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { NFL_TEAM_CODES, type TeamCode } from "@bbb/shared";
import { db } from "../src/db/client.js";
import { games } from "../src/db/schema.js";

const seasonYear = Number(process.argv[2] ?? new Date().getFullYear());

type EspnEvent = {
  name: string;
  date: string;
  competitions: Array<{
    status: { type: { completed: boolean } };
    competitors: Array<{
      team: { abbreviation: string };
      homeAway: "home" | "away";
      score?: string;
      winner?: boolean;
    }>;
  }>;
};

function toTeamCode(espnAbbreviation: string): TeamCode | null {
  const code = espnAbbreviation === "WSH" ? "WAS" : espnAbbreviation;
  return (NFL_TEAM_CODES as readonly string[]).includes(code) ? (code as TeamCode) : null;
}

async function fetchWeek(week: number): Promise<EspnEvent[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}&dates=${seasonYear}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`ESPN fetch failed for week ${week}: ${response.status}`);
  const data = (await response.json()) as { events: EspnEvent[] };
  return data.events;
}

// Regular season only — preseason games aren't picked in a survivor pool and
// would collide with regular-season week numbers in our schema. Games are
// shared across every pool running this season (see schema.ts), so this
// only needs to run once per season, not once per pool. Safe to re-run: an
// existing game is updated in place (picks up new/changed scores/results)
// rather than skipped, so this also works to backfill historical seasons.
for (let week = 1; week <= 18; week++) {
  const events = await fetchWeek(week);
  if (events.length === 0) {
    console.log(`Week ${week}: no games found from ESPN, skipping`);
    continue;
  }

  let imported = 0;
  let updated = 0;

  for (const event of events) {
    const competition = event.competitions[0];
    const competitors = competition.competitors;
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    const homeTeam = home && toTeamCode(home.team.abbreviation);
    const awayTeam = away && toTeamCode(away.team.abbreviation);

    if (!homeTeam || !awayTeam || !home || !away) {
      console.warn(`  Week ${week}: unrecognized matchup "${event.name}", skipping`);
      continue;
    }

    const kickoffTime = new Date(event.date);

    const isCompleted = competition.status.type.completed;
    const homeScore = isCompleted && home.score !== undefined ? Number(home.score) : null;
    const awayScore = isCompleted && away.score !== undefined ? Number(away.score) : null;
    const result = !isCompleted
      ? ("pending" as const)
      : home.winner
        ? ("home_win" as const)
        : away.winner
          ? ("away_win" as const)
          : ("tie" as const);

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
