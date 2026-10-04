import "dotenv/config";
import { and, asc, eq, inArray, lte, min } from "drizzle-orm";
import { db } from "../src/db/client.js";
import { entries, games, picks, pools, user } from "../src/db/schema.js";

// Late-start clean-up: removes picks made for weeks that were played before the pool started,
// so every player starts with a clean slate and no team already used (the "bye" for those weeks).
// Operator script, because only a pick's owner can change it and those weeks have locked.
//
// Usage: pnpm clear-early-picks --through 4            (dry run: lists what it would delete)
//        pnpm clear-early-picks --through 4 --apply    (deletes them)
//
// Safety: --through is required; only picks whose result is still "pending", in a week whose
// first kickoff has already passed and that is not later than --through, are touched. Nothing
// else is changed, and nobody is eliminated or scored. No emails are printed.

const apply = process.argv.includes("--apply");
const flag = process.argv.indexOf("--through");
const through = flag >= 0 ? Number(process.argv[flag + 1]) : NaN;
if (!Number.isInteger(through) || through < 1 || through > 22) {
  console.error("Give the last week to clear, for example: --through 4");
  process.exit(1);
}

const now = new Date();
const found: { id: string; poolName: string; week: number; team: string; owner: string }[] = [];

for (const pool of await db.select().from(pools).orderBy(asc(pools.createdAt))) {
  const lockRows = await db
    .select({ week: games.weekNumber, lock: min(games.kickoffTime) })
    .from(games)
    .where(eq(games.seasonYear, pool.seasonYear))
    .groupBy(games.weekNumber);
  const locked = new Set(lockRows.filter((r) => r.lock && new Date(r.lock) <= now).map((r) => r.week));

  const rows = await db
    .select({
      id: picks.id,
      week: picks.weekNumber,
      team: picks.teamCode,
      invitedName: entries.invitedName,
      userName: user.name,
    })
    .from(picks)
    .innerJoin(entries, eq(picks.entryId, entries.id))
    .leftJoin(user, eq(entries.userId, user.id))
    .where(and(eq(entries.poolId, pool.id), lte(picks.weekNumber, through), eq(picks.result, "pending")));

  for (const r of rows) {
    if (!locked.has(r.week)) continue;
    found.push({ id: r.id, poolName: pool.name, week: r.week, team: r.team, owner: r.userName ?? r.invitedName ?? "a player" });
  }
}

console.log(apply ? "Deleting early picks..." : "Dry run (nothing is deleted). Add --apply to delete.");
if (found.length === 0) console.log("  No pending picks in locked weeks up to week " + through + ".");
for (const f of found) console.log(`  ${apply ? "delete" : "would delete"}  ${f.poolName}: week ${f.week}, ${f.team}, ${f.owner}`);

if (apply && found.length > 0) {
  await db.delete(picks).where(inArray(picks.id, found.map((f) => f.id)));
}
console.log(`${apply ? "Deleted" : "Would delete"} ${found.length} pick${found.length === 1 ? "" : "s"}.`);
process.exit(0);
