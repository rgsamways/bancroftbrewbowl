import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, inArray, max, min, ne, sql } from "drizzle-orm";
import {
  updateCannedPromotionSchema,
  PROMOTION_KINDS,
  type CannedPromotionConfig,
  type PromotionKind,
} from "@bbb/shared";
import { db } from "../db/client.js";
import { cannedPromotions, entries, games, picks, pools } from "../db/schema.js";
import { requireAdmin, requireSession } from "../lib/guards.js";
import { parseBody } from "../lib/validate.js";
import { resolveEntry } from "./entries.js";

const KIND_SET: readonly string[] = PROMOTION_KINDS;

async function ensureCannedPromotionRows() {
  await db
    .insert(cannedPromotions)
    .values(PROMOTION_KINDS.map((kind) => ({ kind })))
    .onConflictDoNothing({ target: cannedPromotions.kind });
}

async function getSeasonPoolIds(seasonYear: number) {
  const seasonPools = await db.query.pools.findMany({ where: eq(pools.seasonYear, seasonYear) });
  return seasonPools.map((p) => p.id);
}

async function findEligibleEntries(poolIds: string[], status: "alive" | "eliminated", eliminatedWeek?: number) {
  if (poolIds.length === 0) return [];
  const conditions = [inArray(entries.poolId, poolIds), eq(entries.status, status)];
  if (eliminatedWeek !== undefined) conditions.push(eq(entries.eliminatedWeek, eliminatedWeek));
  const rows = await db.query.entries.findMany({
    where: and(...conditions),
    with: { user: true, pool: true },
  });
  return rows.map((e) => ({ ...resolveEntry(e), poolName: e.pool.name }));
}

export async function cannedPromotionRoutes(fastify: FastifyInstance) {
  fastify.get("/canned-promotions", async (request, reply) => {
    if (!(await requireSession(request, reply))) return;

    await ensureCannedPromotionRows();
    const rows = await db.query.cannedPromotions.findMany({ orderBy: [asc(cannedPromotions.kind)] });
    reply.send(rows);
  });

  fastify.patch("/canned-promotions/:kind", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;

    const { kind } = request.params as { kind: string };
    if (!KIND_SET.includes(kind)) {
      reply.status(404).send({ error: "Unknown promotion kind" });
      return;
    }
    const body = parseBody(updateCannedPromotionSchema, request.body, reply);
    if (!body) return;

    await ensureCannedPromotionRows();
    const existing = await db.query.cannedPromotions.findFirst({
      where: eq(cannedPromotions.kind, kind as PromotionKind),
    });
    if (!existing) {
      reply.status(404).send({ error: "Unknown promotion kind" });
      return;
    }

    const updates: Partial<typeof cannedPromotions.$inferInsert> = {};
    if (body.enabled !== undefined) updates.enabled = body.enabled;
    if (body.config !== undefined) {
      updates.config = { ...(existing.config as CannedPromotionConfig), ...body.config };
    }

    const [updated] = await db
      .update(cannedPromotions)
      .set(updates)
      .where(eq(cannedPromotions.kind, kind as PromotionKind))
      .returning();
    reply.send(updated);
  });

  fastify.get("/canned-promotions/:kind/eligible", async (request, reply) => {
    if (!(await requireSession(request, reply))) return;

    const { kind } = request.params as { kind: string };
    const { year } = request.query as { year?: string };
    if (!KIND_SET.includes(kind)) {
      reply.status(404).send({ error: "Unknown promotion kind" });
      return;
    }
    if (!year) {
      reply.status(400).send({ error: "year is required" });
      return;
    }
    const seasonYear = Number(year);
    const poolIds = await getSeasonPoolIds(seasonYear);

    if (kind === "survivor_sunday") {
      reply.send({ kind, eligibleEntries: await findEligibleEntries(poolIds, "alive") });
      return;
    }

    if (kind === "elimination_consolation" || kind === "milestone_reward") {
      // The most recent week with at least one decided game — eligibility is
      // computed live off this instead of a "has this been redeemed yet"
      // table, so it naturally stops applying once the next week's results
      // come in.
      const [latest] = await db
        .select({ weekNumber: max(games.weekNumber) })
        .from(games)
        .where(and(eq(games.seasonYear, seasonYear), ne(games.result, "pending")));
      const latestDecidedWeek = latest?.weekNumber ? Number(latest.weekNumber) : null;

      if (latestDecidedWeek === null) {
        reply.send({ kind, weekNumber: null, eligibleEntries: [] });
        return;
      }

      if (kind === "elimination_consolation") {
        reply.send({
          kind,
          weekNumber: latestDecidedWeek,
          eligibleEntries: await findEligibleEntries(poolIds, "eliminated", latestDecidedWeek),
        });
        return;
      }

      const promo = await db.query.cannedPromotions.findFirst({
        where: eq(cannedPromotions.kind, "milestone_reward"),
      });
      const milestoneWeeks = (promo?.config as CannedPromotionConfig | undefined)?.milestone_weeks ?? [];
      const eligibleEntries = milestoneWeeks.includes(latestDecidedWeek)
        ? await findEligibleEntries(poolIds, "alive")
        : [];
      reply.send({ kind, weekNumber: latestDecidedWeek, eligibleEntries });
      return;
    }

    // hot_team_special — the *upcoming* week (same "first unlocked week,
    // else the last week" resolution used on Home), not the most recently
    // decided one: this is meant to hype up the coming slate of games.
    const weekRows = await db
      .select({ weekNumber: games.weekNumber, pickDeadline: min(games.kickoffTime) })
      .from(games)
      .where(eq(games.seasonYear, seasonYear))
      .groupBy(games.weekNumber)
      .orderBy(asc(games.weekNumber));
    const now = new Date();
    const weeksWithLock = weekRows
      .filter((w) => w.pickDeadline)
      .map((w) => ({ weekNumber: w.weekNumber, locked: now >= new Date(w.pickDeadline!) }));
    const firstUnlocked = weeksWithLock.find((w) => !w.locked);
    const currentWeek = firstUnlocked ? firstUnlocked.weekNumber : (weeksWithLock.at(-1)?.weekNumber ?? null);

    if (currentWeek === null || poolIds.length === 0) {
      reply.send({ kind, weekNumber: currentWeek, teamCode: null, pickCount: 0 });
      return;
    }

    const [top] = await db
      .select({ teamCode: picks.teamCode, count: sql<number>`count(*)::int` })
      .from(picks)
      .innerJoin(entries, eq(picks.entryId, entries.id))
      .where(and(eq(picks.weekNumber, currentWeek), inArray(entries.poolId, poolIds)))
      .groupBy(picks.teamCode)
      .orderBy(desc(sql`count(*)`))
      .limit(1);

    reply.send({ kind, weekNumber: currentWeek, teamCode: top?.teamCode ?? null, pickCount: top?.count ?? 0 });
  });
}
