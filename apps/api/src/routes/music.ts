import type { FastifyInstance } from "fastify";
import { asc, desc, eq, gte, lt } from "drizzle-orm";
import {
  bucketOf,
  createMusicEventSchema,
  easternToday,
  formatEventDayLong,
  updateMusicEventSchema,
  type AdminMusic,
  type MusicEvent,
  type PublicMusic,
} from "@bbb/shared";
import { db } from "../db/client.js";
import { musicEvents } from "../db/schema.js";
import { requireAdmin } from "../lib/guards.js";
import { actorOf, recordActivity } from "../lib/activity.js";
import { parseBody } from "../lib/validate.js";

// Live music. Reading the list needs no sign-in (the table QR code opens it); changing it needs
// an admin, and every change is recorded in Activity.

/** The database stores a time as "13:00:00"; the screens and the API use "13:00". */
const hm = (t: string | null) => (t ? t.slice(0, 5) : null);

const toEvent = (row: typeof musicEvents.$inferSelect): MusicEvent => ({
  id: row.id,
  title: row.title,
  date: row.eventDate,
  startTime: hm(row.startTime),
  endTime: hm(row.endTime),
});

const inOrder = [asc(musicEvents.eventDate), asc(musicEvents.startTime), asc(musicEvents.title)];

export async function loadPublicMusic(now = new Date()): Promise<PublicMusic> {
  const today = easternToday(now);
  const rows = await db.query.musicEvents.findMany({ where: gte(musicEvents.eventDate, today), orderBy: inOrder });
  const music: PublicMusic = { thisWeekend: [], comingUp: [] };
  for (const row of rows) {
    const bucket = bucketOf(row.eventDate, today);
    if (bucket === "thisWeekend") music.thisWeekend.push(toEvent(row));
    else if (bucket === "comingUp") music.comingUp.push(toEvent(row));
  }
  return music;
}

async function loadAdminMusic(now = new Date()): Promise<AdminMusic> {
  const today = easternToday(now);
  const [comingUp, past] = await Promise.all([
    db.query.musicEvents.findMany({ where: gte(musicEvents.eventDate, today), orderBy: inOrder }),
    db.query.musicEvents.findMany({ where: lt(musicEvents.eventDate, today), orderBy: [desc(musicEvents.eventDate), desc(musicEvents.startTime)], limit: 50 }),
  ]);
  return { comingUp: comingUp.map(toEvent), past: past.map(toEvent) };
}

export async function musicRoutes(fastify: FastifyInstance) {
  // No sign-in. Always revalidated, like the menu, so a new band shows the next time it is loaded.
  fastify.get("/public/music", async (_request, reply) => {
    reply.header("Cache-Control", "public, max-age=0, must-revalidate");
    reply.send(await loadPublicMusic());
  });

  fastify.get("/music/events", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    reply.send(await loadAdminMusic());
  });

  fastify.post("/music/events", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const body = parseBody(createMusicEventSchema, request.body, reply);
    if (!body) return;
    const actor = actorOf(session);

    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(musicEvents)
        .values({ title: body.title, eventDate: body.date, startTime: body.startTime, endTime: body.endTime })
        .returning();
      await recordActivity(tx, actor, {
        kind: "music_event_added",
        summary: `${actor.name} added "${body.title}" to the music schedule for ${formatEventDayLong(body.date)}.`,
      });
      return row!;
    });
    reply.status(201).send(toEvent(created));
  });

  fastify.patch("/music/events/:id", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const body = parseBody(updateMusicEventSchema, request.body, reply);
    if (!body) return;
    const actor = actorOf(session);
    const { id } = request.params as { id: string };

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(musicEvents)
        .set({ title: body.title, eventDate: body.date, startTime: body.startTime, endTime: body.endTime })
        .where(eq(musicEvents.id, id))
        .returning();
      if (!row) return null;
      await recordActivity(tx, actor, {
        kind: "music_event_changed",
        summary: `${actor.name} changed "${body.title}" on the music schedule (${formatEventDayLong(body.date)}).`,
      });
      return row;
    });
    if (!updated) {
      reply.status(404).send({ error: "Event not found" });
      return;
    }
    reply.send(toEvent(updated));
  });

  fastify.delete("/music/events/:id", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const actor = actorOf(session);
    const { id } = request.params as { id: string };

    const removed = await db.transaction(async (tx) => {
      const [row] = await tx.delete(musicEvents).where(eq(musicEvents.id, id)).returning();
      if (!row) return null;
      await recordActivity(tx, actor, {
        kind: "music_event_removed",
        summary: `${actor.name} removed "${row.title}" (${formatEventDayLong(row.eventDate)}) from the music schedule.`,
      });
      return row;
    });
    if (!removed) {
      reply.status(404).send({ error: "Event not found" });
      return;
    }
    reply.status(204).send();
  });
}
