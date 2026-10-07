import type { FastifyInstance } from "fastify";
import { and, desc, eq, gte, isNull, or, sql } from "drizzle-orm";
import { createNoticeSchema, easternToday, MAX_ACTIVE_NOTICES, type Notice } from "@bbb/shared";
import { db } from "../db/client.js";
import { promotions } from "../db/schema.js";
import { requireAdmin, requireSession } from "../lib/guards.js";
import { actorOf, recordActivity } from "../lib/activity.js";
import { parseBody } from "../lib/validate.js";

// Site notices: an important message at the top of every player page. They live in the promotions
// table with kind "notice" (title, message, and the last day to show it), newest first. Every
// post and removal is recorded in Activity.

const activeWhere = (today: string) => and(eq(promotions.kind, "notice"), or(isNull(promotions.onDate), gte(promotions.onDate, today)));

async function loadActive(date = new Date()): Promise<Notice[]> {
  const rows = await db.query.promotions.findMany({ where: activeWhere(easternToday(date)), orderBy: [desc(promotions.createdAt)] });
  return rows.map((r) => ({ id: r.id, title: r.title, message: r.description, showThrough: r.onDate }));
}

export async function noticeRoutes(fastify: FastifyInstance) {
  fastify.get("/me/notices", async (request, reply) => {
    if (!(await requireSession(request, reply))) return;
    reply.header("Cache-Control", "no-store");
    reply.send({ notices: await loadActive() });
  });

  fastify.get("/notices", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    reply.send({ notices: await loadActive() });
  });

  fastify.post("/notices", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const parsed = parseBody(createNoticeSchema, request.body, reply);
    if (!parsed) return;
    const body = { title: parsed.title, message: parsed.message, showThrough: parsed.showThrough ?? null };
    const actor = actorOf(session);
    const today = easternToday(new Date());

    if (body.showThrough !== null && body.showThrough < today) {
      reply.status(400).send({ error: "That date has already gone. Pick today or a later day." });
      return;
    }

    const created = await db.transaction(async (tx) => {
      // Serialise posts so two admins cannot both add a fourth.
      await tx.execute(sql`select pg_advisory_xact_lock(7301)`);
      const active = await tx.query.promotions.findMany({ where: activeWhere(today) });
      if (active.length >= MAX_ACTIVE_NOTICES) return null;
      const [row] = await tx
        .insert(promotions)
        .values({ kind: "notice", title: body.title, description: body.message, onDate: body.showThrough })
        .returning();
      await recordActivity(tx, actor, {
        kind: "notice_posted",
        summary: `${actor.name} posted the notice "${body.title}"${body.showThrough ? ` (showing through ${body.showThrough})` : ""}.`,
      });
      return row!;
    });
    if (!created) {
      reply.status(409).send({ error: `${MAX_ACTIVE_NOTICES} notices are already showing. Remove one first.` });
      return;
    }
    reply.status(201).send({ id: created.id });
  });

  fastify.delete("/notices/:id", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const actor = actorOf(session);
    const { id } = request.params as { id: string };
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      reply.status(404).send({ error: "Not found" });
      return;
    }
    const removed = await db.transaction(async (tx) => {
      const [row] = await tx.delete(promotions).where(and(eq(promotions.id, id), eq(promotions.kind, "notice"))).returning();
      if (!row) return null;
      await recordActivity(tx, actor, { kind: "notice_removed", summary: `${actor.name} removed the notice "${row.title}".` });
      return row;
    });
    if (!removed) {
      reply.status(404).send({ error: "Not found" });
      return;
    }
    reply.status(204).send();
  });
}
