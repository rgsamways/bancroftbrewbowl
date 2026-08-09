import type { FastifyInstance } from "fastify";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { resolveWipeoutSchema } from "@bbb/shared";
import { db } from "../db/client.js";
import { entries, games, wipeoutEvents } from "../db/schema.js";
import { requireAdmin } from "../lib/guards.js";
import { parseBody } from "../lib/validate.js";
import { resolveEntry } from "./entries.js";

export async function wipeoutRoutes(fastify: FastifyInstance) {
  fastify.get("/pools/:poolId/wipeouts", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;

    const { poolId } = request.params as { poolId: string };
    const events = await db.query.wipeoutEvents.findMany({
      where: and(eq(wipeoutEvents.poolId, poolId), isNull(wipeoutEvents.resolvedAt)),
      orderBy: [asc(wipeoutEvents.createdAt)],
    });

    const response = await Promise.all(
      events.map(async (event) => {
        const game = await db.query.games.findFirst({ where: eq(games.id, event.gameId) });
        const candidateEntries = await db.query.entries.findMany({
          where: inArray(entries.id, event.candidateEntryIds),
          with: { user: true },
        });
        return {
          id: event.id,
          poolId: event.poolId,
          weekNumber: event.weekNumber,
          gameId: event.gameId,
          game: game ? { homeTeam: game.homeTeam, awayTeam: game.awayTeam } : null,
          candidateEntries: candidateEntries.map(resolveEntry),
          createdAt: event.createdAt,
        };
      })
    );
    reply.send(response);
  });

  fastify.post("/pools/:poolId/wipeouts/:wipeoutId/resolve", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;

    const { poolId, wipeoutId } = request.params as { poolId: string; wipeoutId: string };
    const body = parseBody(resolveWipeoutSchema, request.body, reply);
    if (!body) return;

    const event = await db.query.wipeoutEvents.findFirst({
      where: and(eq(wipeoutEvents.id, wipeoutId), eq(wipeoutEvents.poolId, poolId)),
    });
    if (!event) {
      reply.status(404).send({ error: "Wipeout event not found" });
      return;
    }
    if (event.resolvedAt) {
      reply.status(409).send({ error: "Wipeout already resolved" });
      return;
    }
    const candidateSet = new Set(event.candidateEntryIds);
    if (!body.surviving_entry_ids.every((id) => candidateSet.has(id))) {
      reply.status(400).send({ error: "surviving_entry_ids must be a subset of the candidate entries" });
      return;
    }

    const survivingSet = new Set(body.surviving_entry_ids);
    const toEliminate = event.candidateEntryIds.filter((id) => !survivingSet.has(id));

    const [updated] = await db.transaction(async (tx) => {
      if (toEliminate.length > 0) {
        await tx
          .update(entries)
          .set({ status: "eliminated", eliminatedWeek: event.weekNumber })
          .where(inArray(entries.id, toEliminate));
      }
      return tx
        .update(wipeoutEvents)
        .set({
          resolvedAt: new Date(),
          resolvedBy: session.user.id,
          survivingEntryIds: body.surviving_entry_ids,
        })
        .where(eq(wipeoutEvents.id, wipeoutId))
        .returning();
    });

    reply.send(updated);
  });
}
