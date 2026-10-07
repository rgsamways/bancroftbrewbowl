import { isAdminUser } from "../lib/operator.js";
import type { FastifyInstance } from "fastify";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { createEntrySchema, needsConfirmation, publicName, updateEntrySchema, type PickEmRulesConfig, type RequestCreated } from "@bbb/shared";
import { db } from "../db/client.js";
import { entries, picks, pools, user } from "../db/schema.js";
import { requireAdmin, requireSession } from "../lib/guards.js";
import { actorOf, recordActivity } from "../lib/activity.js";
import { applyStatusChange, createRequest, otherAdmins, settleRequestsFor } from "../lib/admin-requests.js";
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
    displayName: publicName(entry.user?.name, entry.invitedName),
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

    // A person with no account yet needs a name so the roster can show who they are.
    if (!existingUser && !body.display_name) {
      reply.status(422).send({ error: "This email has no account yet. Add their name too.", code: "NAME_REQUIRED" });
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
      const addedName = existingUser?.name ?? body.display_name ?? body.email;
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
      isAdminUser(session.user) || (entryUserId !== null && entryUserId === session.user.id);

    const { poolId } = request.params as { poolId: string };
    const pool = await db.query.pools.findFirst({ where: eq(pools.id, poolId) });
    const poolEntries = await db.query.entries.findMany({
      where: eq(entries.poolId, poolId),
      orderBy: [asc(entries.createdAt)],
      with: { user: true },
    });

    // For an admin the roster also says who has no account yet and which entry is theirs.
    // Players do not get these two flags.
    const adminFlags = (entry: (typeof poolEntries)[number]) =>
      isAdminUser(session.user) ? { invited: entry.user === null, isYou: entry.userId === session.user.id } : {};

    if (pool?.type === "pick_em") {
      const tieHandling = (pool.rules as PickEmRulesConfig).tie_handling;
      const pointsByEntry = await computePickEmPoints(poolEntries.map((e) => e.id), tieHandling);
      reply.send(
        poolEntries.map((entry) => ({
          ...resolveEntry(entry, pointsByEntry.get(entry.id) ?? 0, { includeEmail: seesEmail(entry.userId) }),
          ...adminFlags(entry),
        }))
      );
      return;
    }

    reply.send(
      poolEntries.map((entry) => ({
        ...resolveEntry(entry, undefined, { includeEmail: seesEmail(entry.userId) }),
        ...adminFlags(entry),
      }))
    );
  });

  fastify.patch("/entries/:entryId", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;

    const { entryId } = request.params as { entryId: string };
    const body = parseBody(updateEntrySchema, request.body, reply);
    if (!body) return;
    const actor = actorOf(session);

    const before = await db.query.entries.findFirst({ where: eq(entries.id, entryId), with: { user: true, pool: true } });
    if (!before) {
      reply.status(404).send({ error: "Entry not found" });
      return;
    }

    // Alive clears the week; Out needs one (from this request or already on the entry).
    const status = body.status ?? before.status;
    let eliminatedWeek = body.eliminatedWeek === undefined ? before.eliminatedWeek : body.eliminatedWeek;
    if (before.status === "alive" && body.status === undefined && body.eliminatedWeek != null) {
      reply.status(400).send({ error: "Only a player who is out has a week they went out." });
      return;
    }
    if (status === "alive") eliminatedWeek = null;
    if (status === "eliminated" && eliminatedWeek === null) {
      reply.status(400).send({ error: "Say which week they went out." });
      return;
    }
    const changes = { status, eliminatedWeek };

    const who = before.user?.name ?? before.invitedName ?? "a player";

    // Changing your own status is not yours to decide alone: it becomes a request for another admin.
    const others = await otherAdmins(db, actor.id);
    if (needsConfirmation({ touchesOwnEntry: before.userId === actor.id, otherAdmins: others.length })) {
      const request = await db.transaction(async (tx) => {
        const created = await createRequest(tx, {
          kind: "status_change",
          poolId: before.poolId,
          entryId,
          payload: { from: { status: before.status, eliminatedWeek: before.eliminatedWeek }, to: changes },
          actor,
        });
        await recordActivity(tx, actor, {
          kind: "confirmation_requested",
          summary: `${actor.name} asked another admin to confirm a change to their own status in ${before.pool.name}.`,
          poolId: before.poolId,
          affectsOwnEntry: true,
        });
        return created;
      });
      const created: RequestCreated = { request: { id: request.id, askedAdmins: others.map((a) => a.name) } };
      reply.status(202).send(created);
      return;
    }

    const entry = await db.transaction(async (tx) => {
      const updated = await applyStatusChange(tx, entryId, changes);
      await settleRequestsFor(tx, { entryId });
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
      return updated;
    });
    const linkedUser = entry.userId ? await db.query.user.findFirst({ where: eq(user.id, entry.userId) }) : null;
    reply.send(resolveEntry({ ...entry, user: linkedUser ?? null }, undefined, WITH_EMAIL));
  });
}
