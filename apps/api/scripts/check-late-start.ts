import "dotenv/config";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "../src/db/client.js";
import { entries, games, picks, pools } from "../src/db/schema.js";

// Read-only look at where the pools stand before the late-start catch-up (results for the
// weeks that have already been played). It writes nothing and prints counts only: no names,
// no emails, no one's pick. Usage: pnpm check-late-start

console.log(`Now: ${new Date().toISOString()}\n`);

const allPools = await db.select().from(pools).orderBy(asc(pools.createdAt));
if (allPools.length === 0) console.log("No pools.");

for (const pool of allPools) {
  const poolEntries = await db.select({ status: entries.status }).from(entries).where(eq(entries.poolId, pool.id));
  const alive = poolEntries.filter((e) => e.status === "alive").length;
  console.log(`Pool "${pool.name}": ${pool.type}, season ${pool.seasonYear}, ${pool.status}, ${poolEntries.length} players (${alive} alive)`);

  const weeks = await db
    .select({
      week: games.weekNumber,
      games: sql<number>`count(*)::int`,
      pending: sql<number>`(count(*) filter (where ${games.result} = 'pending'))::int`,
      firstKickoff: sql<string>`min(${games.kickoffTime})::text`,
    })
    .from(games)
    .where(eq(games.seasonYear, pool.seasonYear))
    .groupBy(games.weekNumber)
    .orderBy(asc(games.weekNumber));

  const pickRows = await db
    .select({ week: picks.weekNumber, count: sql<number>`count(*)::int` })
    .from(picks)
    .innerJoin(entries, eq(picks.entryId, entries.id))
    .where(eq(entries.poolId, pool.id))
    .groupBy(picks.weekNumber)
    .orderBy(asc(picks.weekNumber));
  const picksByWeek = new Map(pickRows.map((r) => [r.week, r.count]));

  console.log("  week  games  undecided  picks  first kickoff (UTC)");
  for (const w of weeks.slice(0, 8)) {
    console.log(
      `  ${String(w.week).padStart(4)}  ${String(w.games).padStart(5)}  ${String(w.pending).padStart(9)}  ${String(picksByWeek.get(w.week) ?? 0).padStart(5)}  ${w.firstKickoff}`
    );
  }
  const weeksWithPicks = [...picksByWeek.keys()].sort((a, b) => a - b);
  console.log(`  Weeks with any picks: ${weeksWithPicks.length === 0 ? "none" : weeksWithPicks.join(", ")}\n`);
}

process.exit(0);
