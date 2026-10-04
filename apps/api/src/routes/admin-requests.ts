import type { FastifyInstance } from "fastify";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { DECLINE_REASON_MAX, type AdminRequestDetail, type RequestKind, type RequestStatus } from "@bbb/shared";
import { db } from "../db/client.js";
import { adminRequests, entries, picks, pools, wipeoutEvents } from "../db/schema.js";
import { applyStatusChange, applyWipeoutResolution, otherAdmins, type StatusChange } from "../lib/admin-requests.js";
import { actorOf, recordActivity } from "../lib/activity.js";
import { requireAdmin, requireSession } from "../lib/guards.js";
import { parseBody } from "../lib/validate.js";

type RequestRow = typeof adminRequests.$inferSelect;
type StatusPayload = { from: StatusChange; to: StatusChange };

const declineSchema = z.object({ reason: z.string().trim().max(DECLINE_REASON_MAX).optional() }).strict();

const same = (a: StatusChange, b: StatusChange) => a.status === b.status && a.eliminatedWeek === b.eliminatedWeek;

async function load(id: string) {
  return db.query.adminRequests.findFirst({ where: eq(adminRequests.id, id) });
}

const entryName = (e: { user: { name: string } | null; invitedName: string | null }) => e.user?.name ?? e.invitedName ?? "a player";

/** Everything the confirm screen shows: what was chosen and what it would do. Names and the
 * chosen players only: no emails. */
async function detailOf(row: RequestRow, viewerId: string): Promise<AdminRequestDetail> {
  const pool = await db.query.pools.findFirst({ where: eq(pools.id, row.poolId) });
  const isRequester = row.requestedBy === viewerId;
  const others = row.requestedBy ? await otherAdmins(db, row.requestedBy) : [];
  const detail: AdminRequestDetail = {
    id: row.id,
    kind: row.kind as RequestKind,
    status: row.status as RequestStatus,
    poolId: row.poolId,
    poolName: pool?.name ?? "a pool",
    requestedByName: row.requestedByName,
    decidedByName: row.decidedByName,
    declineReason: row.declineReason,
    canDecide: row.status === "pending" && !isRequester,
    isRequester,
    askedAdmins: others.map((a) => a.name),
    weekNumber: null,
    game: null,
    players: [],
    change: null,
  };

  if (row.kind === "wipeout_resolution" && row.wipeoutId) {
    const event = await db.query.wipeoutEvents.findFirst({ where: eq(wipeoutEvents.id, row.wipeoutId), with: { game: true } });
    if (event) {
      const kept = new Set((row.payload as { survivingEntryIds: string[] }).survivingEntryIds);
      const candidates = await db.query.entries.findMany({ where: inArray(entries.id, event.candidateEntryIds), with: { user: true } });
      const weekPicks = await db.query.picks.findMany({
        where: and(inArray(picks.entryId, event.candidateEntryIds), eq(picks.weekNumber, event.weekNumber)),
      });
      detail.weekNumber = event.weekNumber;
      detail.game = event.game ? { homeTeam: event.game.homeTeam, awayTeam: event.game.awayTeam } : null;
      detail.players = candidates.map((c) => ({
        id: c.id,
        displayName: entryName(c),
        kept: kept.has(c.id),
        isRequesterEntry: c.userId === row.requestedBy,
        pickedTeams: weekPicks.filter((p) => p.entryId === c.id).map((p) => p.teamCode),
      }));
    }
  } else if (row.kind === "status_change" && row.entryId) {
    const entry = await db.query.entries.findFirst({ where: eq(entries.id, row.entryId), with: { user: true } });
    if (entry) {
      const payload = row.payload as StatusPayload;
      detail.change = {
        displayName: entryName(entry),
        isRequesterEntry: entry.userId === row.requestedBy,
        from: payload.from,
        to: payload.to,
      };
    }
  }
  return detail;
}

/** Applies a request's decision, or says why it can no longer be applied. */
async function applyRequest(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], row: RequestRow, confirmerId: string) {
  if (row.kind === "wipeout_resolution") {
    const event = row.wipeoutId ? await tx.query.wipeoutEvents.findFirst({ where: eq(wipeoutEvents.id, row.wipeoutId) }) : null;
    if (!event || event.resolvedAt) return { ok: false as const };
    const surviving = (row.payload as { survivingEntryIds: string[] }).survivingEntryIds;
    await applyWipeoutResolution(tx, event, surviving, confirmerId);
    return { ok: true as const, summary: `kept ${surviving.length} ${surviving.length === 1 ? "player" : "players"} alive after a wipeout` };
  }
  const entry = row.entryId ? await tx.query.entries.findFirst({ where: eq(entries.id, row.entryId) }) : null;
  const payload = row.payload as StatusPayload;
  if (!entry || !same({ status: entry.status, eliminatedWeek: entry.eliminatedWeek }, payload.from)) return { ok: false as const };
  await applyStatusChange(tx, entry.id, payload.to);
  return { ok: true as const, summary: `changed their own status to ${payload.to.status === "alive" ? "alive" : "eliminated"}` };
}

export async function adminRequestRoutes(fastify: FastifyInstance) {
  fastify.get("/admin/requests/:id", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const row = await load((request.params as { id: string }).id);
    if (!row) {
      reply.status(404).send({ error: "Request not found" });
      return;
    }
    reply.send(await detailOf(row, session.user.id));
  });

  fastify.post("/admin/requests/:id/confirm", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const actor = actorOf(session);
    const { id } = request.params as { id: string };

    const outcome = await db.transaction(async (tx) => {
      // Lock the row so two admins acting at once cannot both apply it.
      const [row] = await tx.select().from(adminRequests).where(eq(adminRequests.id, id)).for("update");
      if (!row) return { code: 404 as const };
      if (row.status !== "pending") return { code: 409 as const, error: "This request has already been dealt with." };
      if (row.requestedBy === actor.id) return { code: 403 as const };

      const pool = await tx.query.pools.findFirst({ where: eq(pools.id, row.poolId) });
      const applied = await applyRequest(tx, row, actor.id);
      if (!applied.ok) {
        await tx.update(adminRequests).set({ status: "cancelled", decidedAt: new Date() }).where(eq(adminRequests.id, id));
        return { code: 409 as const, error: "This is out of date: things have changed since it was asked. Nothing was applied." };
      }
      await tx
        .update(adminRequests)
        .set({ status: "confirmed", decidedBy: actor.id, decidedByName: actor.name, decidedAt: new Date() })
        .where(eq(adminRequests.id, id));
      await recordActivity(tx, actor, {
        kind: "confirmation_confirmed",
        summary: `${actor.name} confirmed ${row.requestedByName}'s decision in ${pool?.name ?? "a pool"}: ${row.requestedByName} ${applied.summary}.`,
        poolId: row.poolId,
        affectsOwnEntry: true,
      });
      return { code: 200 as const };
    });

    if (outcome.code === 404) reply.status(404).send({ error: "Request not found" });
    else if (outcome.code === 403) reply.status(403).send({ error: "You can't confirm your own decision. Another admin has to." });
    else if (outcome.code === 409) reply.status(409).send({ error: outcome.error });
    else reply.send({ ok: true });
  });

  fastify.post("/admin/requests/:id/decline", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const body = parseBody(declineSchema, request.body ?? {}, reply);
    if (!body) return;
    const actor = actorOf(session);
    const { id } = request.params as { id: string };

    const outcome = await db.transaction(async (tx) => {
      const [row] = await tx.select().from(adminRequests).where(eq(adminRequests.id, id)).for("update");
      if (!row) return { code: 404 as const };
      if (row.status !== "pending") return { code: 409 as const };
      if (row.requestedBy === actor.id) return { code: 403 as const };
      const pool = await tx.query.pools.findFirst({ where: eq(pools.id, row.poolId) });
      await tx
        .update(adminRequests)
        .set({
          status: "declined",
          decidedBy: actor.id,
          decidedByName: actor.name,
          decidedAt: new Date(),
          declineReason: body.reason || null,
        })
        .where(eq(adminRequests.id, id));
      await recordActivity(tx, actor, {
        kind: "confirmation_declined",
        summary: `${actor.name} did not confirm ${row.requestedByName}'s decision in ${pool?.name ?? "a pool"}${body.reason ? `: "${body.reason}"` : "."}`,
        poolId: row.poolId,
        affectsOwnEntry: true,
      });
      return { code: 200 as const };
    });

    if (outcome.code === 404) reply.status(404).send({ error: "Request not found" });
    else if (outcome.code === 403) reply.status(403).send({ error: "You can't decline your own decision." });
    else if (outcome.code === 409) reply.status(409).send({ error: "This request has already been dealt with." });
    else reply.send({ ok: true });
  });

  // The requester dismissing a declined notice. It is their own notification, not a change to
  // the standings, so it is not an admin change and has no activity record.
  fastify.post("/admin/requests/:id/seen", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    const row = await load(id);
    if (!row || row.requestedBy !== session.user.id) {
      reply.status(404).send({ error: "Request not found" });
      return;
    }
    await db.update(adminRequests).set({ seenAt: new Date() }).where(eq(adminRequests.id, id));
    reply.send({ ok: true });
  });
}
