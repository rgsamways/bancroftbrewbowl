import type { FastifyInstance } from "fastify";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { resolveWipeoutSchema } from "@bbb/shared";
import { db } from "../db/client.js";
import { entries, games, picks, pools, wipeoutEvents } from "../db/schema.js";
import { actorOf, recordActivity } from "../lib/activity.js";
import { requireAdmin } from "../lib/guards.js";
import { parseBody } from "../lib/validate.js";
import { resolveEntry, WITH_EMAIL } from "./entries.js";

export async function wipeoutRoutes(fastify: FastifyInstance) {
  fastify.get("/pools/:poolId/wipeouts", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;

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
        const weekPicks = await db.query.picks.findMany({
          where: and(inArray(picks.entryId, event.candidateEntryIds), eq(picks.weekNumber, event.weekNumber)),
        });
        return {
          id: event.id,
          poolId: event.poolId,
          weekNumber: event.weekNumber,
          gameId: event.gameId,
          game: game ? { homeTeam: game.homeTeam, awayTeam: game.awayTeam } : null,
          // Admin-only route, so emails are fine. Written as an explicit call: the old
          // `.map(resolveEntry)` handed each entry's list position over as its "points".
          // `pickedTeams` is that entry's pick(s) for the week (it has locked by now, so it is not
          // secret) and `isYou` marks the viewing admin's own entry.
          candidateEntries: candidateEntries.map((entry) => ({
            ...resolveEntry(entry, undefined, WITH_EMAIL),
            pickedTeams: weekPicks.filter((p) => p.entryId === entry.id).map((p) => p.teamCode),
            isYou: entry.userId === session.user.id,
          })),
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

    const actor = actorOf(session);
    const pool = await db.query.pools.findFirst({ where: eq(pools.id, poolId) });
    // Whether the admin is one of the players this decision is about (kept alive or eliminated).
    const ownCandidates = await db.query.entries.findMany({
      where: and(inArray(entries.id, event.candidateEntryIds), eq(entries.userId, actor.id)),
    });
    const kept = body.surviving_entry_ids.length;

    const [updated] = await db.transaction(async (tx) => {
      if (toEliminate.length > 0) {
        await tx
          .update(entries)
          .set({ status: "eliminated", eliminatedWeek: event.weekNumber })
          .where(inArray(entries.id, toEliminate));
      }
      const resolved = await tx
        .update(wipeoutEvents)
        .set({
          resolvedAt: new Date(),
          resolvedBy: session.user.id,
          survivingEntryIds: body.surviving_entry_ids,
        })
        .where(eq(wipeoutEvents.id, wipeoutId))
        .returning();
      // In the same transaction, so the decision and its record stand or fall together.
      await recordActivity(tx, actor, {
        kind: "wipeout_resolved",
        summary:
          kept > 0
            ? `${actor.name} kept ${kept} ${kept === 1 ? "player" : "players"} alive after a wipeout in ${pool?.name ?? "a pool"}.`
            : `${actor.name} resolved a wipeout in ${pool?.name ?? "a pool"}: no players were kept alive.`,
        poolId,
        affectsOwnEntry: ownCandidates.length > 0,
      });
      return resolved;
    });

    reply.send(updated);
  });
}
