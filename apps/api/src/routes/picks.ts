import type { FastifyInstance } from "fastify";
import { and, eq, min, ne } from "drizzle-orm";
import { submitPickSchema, type RulesConfig } from "@bbb/shared";
import { db } from "../db/client.js";
import { entries, games, picks, pools } from "../db/schema.js";
import { requireSession } from "../lib/guards.js";
import { parseBody } from "../lib/validate.js";

export async function pickRoutes(fastify: FastifyInstance) {
  fastify.post("/entries/:entryId/picks", async (request, reply) => {
    if (!(await requireSession(request, reply))) return;

    const { entryId } = request.params as { entryId: string };
    const body = parseBody(submitPickSchema, request.body, reply);
    if (!body) return;

    const entry = await db.query.entries.findFirst({ where: eq(entries.id, entryId) });
    if (!entry) {
      reply.status(404).send({ error: "Entry not found" });
      return;
    }
    if (entry.status !== "alive") {
      reply.status(409).send({ error: "Entry has been eliminated" });
      return;
    }

    const pool = await db.query.pools.findFirst({ where: eq(pools.id, entry.poolId) });
    if (!pool) {
      reply.status(404).send({ error: "Pool not found" });
      return;
    }
    const rules = pool.rules as RulesConfig;

    const [week] = await db
      .select({ pickDeadline: min(games.kickoffTime) })
      .from(games)
      .where(and(eq(games.seasonYear, pool.seasonYear), eq(games.weekNumber, body.week_number)));
    if (!week?.pickDeadline) {
      reply.status(404).send({ error: "Week not found" });
      return;
    }
    if (new Date() >= new Date(week.pickDeadline)) {
      reply.status(409).send({ error: "Pick deadline has passed" });
      return;
    }

    if (!rules.allow_repeat_teams) {
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

    const existingPick = await db.query.picks.findFirst({
      where: and(eq(picks.entryId, entryId), eq(picks.weekNumber, body.week_number)),
    });

    const [pick] = existingPick
      ? await db
          .update(picks)
          .set({ teamCode: body.team_code })
          .where(eq(picks.id, existingPick.id))
          .returning()
      : await db
          .insert(picks)
          .values({ entryId, weekNumber: body.week_number, teamCode: body.team_code })
          .returning();

    reply.status(existingPick ? 200 : 201).send(pick);
  });

  fastify.get("/entries/:entryId/picks", async (request, reply) => {
    if (!(await requireSession(request, reply))) return;

    const { entryId } = request.params as { entryId: string };
    const entryPicks = await db.query.picks.findMany({ where: eq(picks.entryId, entryId) });
    reply.send(entryPicks);
  });

  fastify.get("/pools/:poolId/picks", async (request, reply) => {
    if (!(await requireSession(request, reply))) return;

    const { poolId } = request.params as { poolId: string };
    const rows = await db
      .select({
        entryId: picks.entryId,
        weekNumber: picks.weekNumber,
        teamCode: picks.teamCode,
        result: picks.result,
      })
      .from(picks)
      .innerJoin(entries, eq(picks.entryId, entries.id))
      .where(eq(entries.poolId, poolId));
    reply.send(rows);
  });
}
