import type { FastifyInstance } from "fastify";
import { and, count, eq, ne } from "drizzle-orm";
import { submitPickSchema, type SurvivorRulesConfig } from "@bbb/shared";
import { db } from "../db/client.js";
import { entries, games, picks, pools } from "../db/schema.js";
import { requireEntryOwner, requireSession } from "../lib/guards.js";
import { getLockedWeeks, getWeekLockTime } from "../lib/pick-lock.js";
import { visiblePicks } from "../lib/pick-visibility.js";
import { parseBody } from "../lib/validate.js";

export async function pickRoutes(fastify: FastifyInstance) {
  fastify.post("/entries/:entryId/picks", async (request, reply) => {
    const { entryId } = request.params as { entryId: string };
    const owned = await requireEntryOwner(request, reply, entryId);
    if (!owned) return;
    const { entry } = owned;

    const body = parseBody(submitPickSchema, request.body, reply);
    if (!body) return;

    if (entry.status !== "alive") {
      reply.status(409).send({ error: "Entry has been eliminated" });
      return;
    }

    const pool = await db.query.pools.findFirst({ where: eq(pools.id, entry.poolId) });
    if (!pool) {
      reply.status(404).send({ error: "Pool not found" });
      return;
    }

    const lockTime = await getWeekLockTime(pool.seasonYear, body.week_number);
    if (!lockTime) {
      reply.status(404).send({ error: "Week not found" });
      return;
    }
    if (new Date() >= lockTime) {
      reply.status(409).send({ error: "Pick deadline has passed" });
      return;
    }

    // Reusing the same team across weeks is normal for pick 'em (you'd
    // pick a strong team most weeks) — this check is survivor-only.
    if (pool.type === "survivor" && !(pool.rules as SurvivorRulesConfig).allow_repeat_teams) {
      const priorUse = await db.query.picks.findFirst({
        where: and(
          eq(picks.entryId, entryId),
          eq(picks.teamCode, body.team_code),
          ne(picks.weekNumber, body.week_number)
        ),
      });
      if (priorUse) {
        reply.status(409).send({ error: `${body.team_code} was already used in week ${priorUse.weekNumber}` });
        return;
      }
    }

    // Survivor: 1 pick per week, or 2 in a designated double-pick week.
    // Pick 'em: one pick per game scheduled that week (pick a winner for
    // every game), so the limit is however many games there are.
    let limit: number;
    if (pool.type === "survivor") {
      limit = (pool.rules as SurvivorRulesConfig).double_pick_weeks.includes(body.week_number) ? 2 : 1;
    } else {
      const [gameCount] = await db
        .select({ count: count() })
        .from(games)
        .where(and(eq(games.seasonYear, pool.seasonYear), eq(games.weekNumber, body.week_number)));
      limit = gameCount?.count ?? 1;
    }
    const weekPicks = await db.query.picks.findMany({
      where: and(eq(picks.entryId, entryId), eq(picks.weekNumber, body.week_number)),
    });

    if (limit === 1) {
      // Unchanged from before double-pick weeks existed: replace-in-place.
      const [pick] = weekPicks[0]
        ? await db
            .update(picks)
            .set({ teamCode: body.team_code })
            .where(eq(picks.id, weekPicks[0].id))
            .returning()
        : await db
            .insert(picks)
            .values({ entryId, weekNumber: body.week_number, teamCode: body.team_code })
            .returning();
      reply.status(weekPicks[0] ? 200 : 201).send(pick);
      return;
    }

    // Double-pick week: explicit slots, insert-only. Changing a pick here
    // means removing it first via DELETE, since there's no way to identify
    // *which* of two existing picks a bare re-POST should replace.
    const already = weekPicks.find((p) => p.teamCode === body.team_code);
    if (already) {
      reply.status(200).send(already);
      return;
    }
    if (weekPicks.length >= limit) {
      reply.status(409).send({
        error: `All ${limit} pick slots for week ${body.week_number} are filled`,
        picks: weekPicks.map((p) => ({ id: p.id, teamCode: p.teamCode })),
      });
      return;
    }
    const [pick] = await db
      .insert(picks)
      .values({ entryId, weekNumber: body.week_number, teamCode: body.team_code })
      .returning();
    reply.status(201).send(pick);
  });

  fastify.delete("/entries/:entryId/picks/:weekNumber/:teamCode", async (request, reply) => {
    const { entryId, weekNumber, teamCode } = request.params as {
      entryId: string;
      weekNumber: string;
      teamCode: string;
    };

    const owned = await requireEntryOwner(request, reply, entryId);
    if (!owned) return;
    const { entry } = owned;

    const pool = await db.query.pools.findFirst({ where: eq(pools.id, entry.poolId) });
    if (!pool) {
      reply.status(404).send({ error: "Pool not found" });
      return;
    }

    const lockTime = await getWeekLockTime(pool.seasonYear, Number(weekNumber));
    if (lockTime && new Date() >= lockTime) {
      reply.status(409).send({ error: "Pick deadline has passed" });
      return;
    }

    const [deleted] = await db
      .delete(picks)
      .where(
        and(
          eq(picks.entryId, entryId),
          eq(picks.weekNumber, Number(weekNumber)),
          eq(picks.teamCode, teamCode)
        )
      )
      .returning();
    if (!deleted) {
      reply.status(404).send({ error: "Pick not found" });
      return;
    }
    reply.send(deleted);
  });

  // Reads go through `visiblePicks`: you always see your own picks, everyone's
  // picks for a week that has locked, and nothing of anyone else's before that
  // (an admin gets a "has picked" marker, with no team). See lib/pick-visibility.ts.
  fastify.get("/entries/:entryId/picks", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const { entryId } = request.params as { entryId: string };
    const entry = await db.query.entries.findFirst({ where: eq(entries.id, entryId) });
    const pool = entry ? await db.query.pools.findFirst({ where: eq(pools.id, entry.poolId) }) : undefined;
    if (!entry || !pool) {
      reply.send([]);
      return;
    }

    const entryPicks = await db.query.picks.findMany({ where: eq(picks.entryId, entryId) });
    const lockedWeeks = await getLockedWeeks(pool.seasonYear);
    const viewer = { userId: session.user.id, isAdmin: Boolean(session.user.isAdmin) };
    reply.send(visiblePicks(entryPicks.map((p) => ({ ...p, ownerUserId: entry.userId })), viewer, lockedWeeks));
  });

  fastify.get("/pools/:poolId/picks", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const { poolId } = request.params as { poolId: string };
    const pool = await db.query.pools.findFirst({ where: eq(pools.id, poolId) });
    if (!pool) {
      reply.send([]);
      return;
    }

    const rows = await db
      .select({
        entryId: picks.entryId,
        weekNumber: picks.weekNumber,
        teamCode: picks.teamCode,
        result: picks.result,
        ownerUserId: entries.userId,
      })
      .from(picks)
      .innerJoin(entries, eq(picks.entryId, entries.id))
      .where(eq(entries.poolId, poolId));

    const lockedWeeks = await getLockedWeeks(pool.seasonYear);
    const viewer = { userId: session.user.id, isAdmin: Boolean(session.user.isAdmin) };
    reply.send(visiblePicks(rows, viewer, lockedWeeks));
  });
}
