import type { FastifyInstance } from "fastify";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { createEntrySchema, type PickEmRulesConfig } from "@bbb/shared";
import { db } from "../db/client.js";
import { entries, picks, pools, user } from "../db/schema.js";
import { requireAdmin, requireSession } from "../lib/guards.js";
import { actorOf, recordActivity } from "../lib/activity.js";
import { parseBody } from "../lib/validate.js";

type EntryRow = {
  id: string;
  poolId: string;
  status: "alive" | "eliminated";
  eliminatedWeek: number | null;
  createdAt: Date;
  invitedName: string | null;
  invitedEmail: string | null;
  user: { name: string; email: string } | null;
};

/** Pass this where the person looking is allowed to see the email: an admin, or
 * the owner of that entry. Everywhere else the email is left blank. */
export const WITH_EMAIL = { includeEmail: true } as const;

/** Resolves an entry's public shape — name/email always come from the linked
 * account when one exists, falling back to the admin's invite details until
 * that person signs in and the entry gets claimed. `points` is only present
 * when the caller passes one (pick 'em pools) — survivor's response shape
 * is unchanged.
 *
 * The email is blank unless `includeEmail` is set, so a new caller can't leak
 * one by forgetting. */
export function resolveEntry(entry: EntryRow, points?: number, options: { includeEmail?: boolean } = {}) {
  return {
    id: entry.id,
    poolId: entry.poolId,
    displayName: entry.user?.name ?? entry.invitedName ?? "Unknown",
    email: options.includeEmail ? (entry.user?.email ?? entry.invitedEmail ?? "") : "",
    status: entry.status,
    eliminatedWeek: entry.eliminatedWeek,
    createdAt: entry.createdAt,
    ...(points !== undefined ? { points } : {}),
  };
}

/** Pick 'em has no stored points total — standings are derived live from
 * `picks.result` (written by scorePickEmPool in lib/scoring.ts) so that a
 * corrected game result is automatically reflected, not just accumulated
 * once and left stale. */
export async function computePickEmPoints(entryIds: string[], tieHandling: PickEmRulesConfig["tie_handling"]) {
  if (entryIds.length === 0) return new Map<string, number>();
  const rows = await db
    .select({
      entryId: picks.entryId,
      wins: sql<number>`count(*) filter (where ${picks.result} = 'win')::int`,
      ties: sql<number>`count(*) filter (where ${picks.result} = 'tie')::int`,
    })
    .from(picks)
    .where(inArray(picks.entryId, entryIds))
    .groupBy(picks.entryId);
  return new Map(rows.map((row) => [row.entryId, row.wins + (tieHandling === "everyone_correct" ? row.ties : 0)]));
}

export async function entryRoutes(fastify: FastifyInstance) {
  fastify.post("/pools/:poolId/entries", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;

    const { poolId } = request.params as { poolId: string };
    const body = parseBody(createEntrySchema, request.body, reply);
    if (!body) return;

    const existingUser = await db.query.user.findFirst({ where: eq(user.email, body.email) });

    const existingEntry = await db.query.entries.findFirst({
      where: and(
        eq(entries.poolId, poolId),
        existingUser ? eq(entries.userId, existingUser.id) : eq(entries.invitedEmail, body.email)
      ),
    });
    if (existingEntry) {
      reply.send(resolveEntry({ ...existingEntry, user: existingUser ?? null }, undefined, WITH_EMAIL));
      return;
    }

    const actor = actorOf(session);
    const pool = await db.query.pools.findFirst({ where: eq(pools.id, poolId) });
    const entry = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(entries)
        .values(
          existingUser
            ? { poolId, userId: existingUser.id }
            : { poolId, invitedEmail: body.email, invitedName: body.display_name }
        )
        .returning();
      const addedName = existingUser?.name ?? body.display_name;
      await recordActivity(tx, actor, {
        kind: "player_added",
        summary: `${actor.name} added ${addedName} to ${pool?.name ?? "a pool"}.`,
        poolId: pool ? poolId : null,
        affectsOwnEntry: existingUser?.id === actor.id,
      });
      return created!;
    });

    reply.status(201).send(resolveEntry({ ...entry, user: existingUser ?? null }, undefined, WITH_EMAIL));
  });

  fastify.post("/pools/:poolId/join", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const { poolId } = request.params as { poolId: string };

    const existing = await db.query.entries.findFirst({
      where: and(eq(entries.poolId, poolId), eq(entries.userId, session.user.id)),
    });
    if (existing) {
      reply.send(resolveEntry({ ...existing, user: session.user }, undefined, WITH_EMAIL));
      return;
    }

    const [entry] = await db.insert(entries).values({ poolId, userId: session.user.id }).returning();

    reply.status(201).send(resolveEntry({ ...entry, user: session.user }, undefined, WITH_EMAIL));
  });

  fastify.get("/me/entries", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const myEntries = await db.query.entries.findMany({
      where: eq(entries.userId, session.user.id),
      orderBy: [asc(entries.createdAt)],
      with: { pool: true, user: true },
    });
    // Your own entries, so your own email is fine to include.
    reply.send(myEntries.map((entry) => ({ ...resolveEntry(entry, undefined, WITH_EMAIL), pool: entry.pool })));
  });

  fastify.get("/pools/:poolId/entries", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    // Names, status and points are for everyone in the pool. An email is only for
    // an admin, and for the person it belongs to.
    const seesEmail = (entryUserId: string | null) =>
      Boolean(session.user.isAdmin) || (entryUserId !== null && entryUserId === session.user.id);

    const { poolId } = request.params as { poolId: string };
    const pool = await db.query.pools.findFirst({ where: eq(pools.id, poolId) });
    const poolEntries = await db.query.entries.findMany({
      where: eq(entries.poolId, poolId),
      orderBy: [asc(entries.createdAt)],
      with: { user: true },
    });

    if (pool?.type === "pick_em") {
      const tieHandling = (pool.rules as PickEmRulesConfig).tie_handling;
      const pointsByEntry = await computePickEmPoints(poolEntries.map((e) => e.id), tieHandling);
      reply.send(
        poolEntries.map((entry) =>
          resolveEntry(entry, pointsByEntry.get(entry.id) ?? 0, { includeEmail: seesEmail(entry.userId) })
        )
      );
      return;
    }

    reply.send(poolEntries.map((entry) => resolveEntry(entry, undefined, { includeEmail: seesEmail(entry.userId) })));
  });

  fastify.patch("/entries/:entryId", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;

    const { entryId } = request.params as { entryId: string };
    const body = request.body as Partial<{ status: "alive" | "eliminated"; eliminatedWeek: number | null }>;
    const actor = actorOf(session);

    const before = await db.query.entries.findFirst({ where: eq(entries.id, entryId), with: { user: true, pool: true } });
    if (!before) {
      reply.status(404).send({ error: "Entry not found" });
      return;
    }

    const entry = await db.transaction(async (tx) => {
      const [updated] = await tx.update(entries).set(body).where(eq(entries.id, entryId)).returning();
      const who = before.user?.name ?? before.invitedName ?? "a player";
      const poolName = before.pool.name;
      const sentence =
        body.status !== undefined
          ? `${actor.name} set ${who} to ${body.status === "alive" ? "alive" : "eliminated"} in ${poolName}.`
          : `${actor.name} changed ${who}'s elimination week in ${poolName}.`;
      await recordActivity(tx, actor, {
        kind: "player_status_changed",
        summary: sentence,
        poolId: before.poolId,
        affectsOwnEntry: before.userId === actor.id,
      });
      return updated!;
    });
    const linkedUser = entry.userId ? await db.query.user.findFirst({ where: eq(user.id, entry.userId) }) : null;
    reply.send(resolveEntry({ ...entry, user: linkedUser ?? null }, undefined, WITH_EMAIL));
  });
}
