import type { PickEmRulesConfig, SurvivorRulesConfig } from "@bbb/shared";
import { inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { adminActivity, entries, games, picks, pools, user } from "../db/schema.js";

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

export async function createEntry(poolId: string, userId?: string) {
  // With a userId the entry belongs to that account, as a claimed entry does in
  // production. Without one it is an unclaimed invite, as before.
  const values = userId
    ? { poolId, userId }
    : { poolId, invitedEmail: `test-${crypto.randomUUID()}@example.com`, invitedName: "Test Entry" };
  const [entry] = await db.insert(entries).values(values).returning();
  if (!entry) throw new Error("Insert returned no row");
  return entry;
}

/** A real `user` row, so entries can belong to someone. Delete it with
 * `cleanupFixtures`' third argument. */
export async function createUser(fields: { name?: string; isAdmin?: boolean } = {}) {
  const id = crypto.randomUUID();
  const [row] = await db
    .insert(user)
    .values({
      id,
      name: fields.name ?? `Test ${id.slice(0, 6)}`,
      email: `test-${id}@example.com`,
      isAdmin: fields.isAdmin ?? false,
    })
    .returning();
  if (!row) throw new Error("Insert returned no row");
  return row;
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
export async function cleanupFixtures(poolIds: string[], gameIds: string[], userIds: string[] = []) {
  if (poolIds.length > 0) await db.delete(pools).where(inArray(pools.id, poolIds));
  if (gameIds.length > 0) await db.delete(games).where(inArray(games.id, gameIds));
  if (userIds.length > 0) {
    // Admin routes under test write activity records. The app can never delete them; the test
    // cleanup removes the ones its own admins made, before the accounts go.
    await db.delete(adminActivity).where(inArray(adminActivity.actorId, userIds));
    await db.delete(user).where(inArray(user.id, userIds));
  }
}
