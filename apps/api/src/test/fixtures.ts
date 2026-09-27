import type { PickEmRulesConfig, SurvivorRulesConfig } from "@bbb/shared";
import { inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { entries, games, picks, pools } from "../db/schema.js";

export async function createPool(type: "survivor", rules: SurvivorRulesConfig, seasonYear?: number): Promise<typeof pools.$inferSelect>;
export async function createPool(type: "pick_em", rules: PickEmRulesConfig, seasonYear?: number): Promise<typeof pools.$inferSelect>;
export async function createPool(
  type: "survivor" | "pick_em",
  rules: SurvivorRulesConfig | PickEmRulesConfig,
  seasonYear = 2999
) {
  const [pool] = await db
    .insert(pools)
    .values({ name: "Test Pool", seasonYear, type, rules, status: "active" })
    .returning();
  if (!pool) throw new Error("Insert returned no row");
  return pool;
}

export async function createEntry(poolId: string) {
  const [entry] = await db
    .insert(entries)
    .values({ poolId, invitedEmail: `test-${crypto.randomUUID()}@example.com`, invitedName: "Test Entry" })
    .returning();
  if (!entry) throw new Error("Insert returned no row");
  return entry;
}

export async function createGame(fields: {
  seasonYear: number;
  weekNumber: number;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: Date;
}) {
  const [game] = await db.insert(games).values({ result: "pending", ...fields }).returning();
  if (!game) throw new Error("Insert returned no row");
  return game;
}

export async function createPick(entryId: string, weekNumber: number, teamCode: string) {
  const [pick] = await db.insert(picks).values({ entryId, weekNumber, teamCode }).returning();
  if (!pick) throw new Error("Insert returned no row");
  return pick;
}

/** Deletes pools (cascades entries, picks, and any wipeoutEvents keyed to
 * them) and games (cascades any wipeoutEvents keyed to them) created by a
 * test. Call from `afterEach` with the IDs created in that test. */
export async function cleanupFixtures(poolIds: string[], gameIds: string[]) {
  if (poolIds.length > 0) await db.delete(pools).where(inArray(pools.id, poolIds));
  if (gameIds.length > 0) await db.delete(games).where(inArray(games.id, gameIds));
}
