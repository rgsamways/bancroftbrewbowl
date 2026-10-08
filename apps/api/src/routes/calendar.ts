import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import {
  REPEAT_TEXT,
  calendarFromAllowed,
  dayDetailsSchema,
  easternToday,
  entrySchema,
  formatEventDayLong,
  isRealDate,
  occursOn,
  type AdminCalendarEntryDetail,
  type CalendarType,
} from "@bbb/shared";
import { db } from "../db/client.js";
import { calendarEntries, calendarExceptions } from "../db/schema.js";
import { requireAdmin } from "../lib/guards.js";
import { actorOf, recordActivity } from "../lib/activity.js";
import { parseBody } from "../lib/validate.js";
import { linkColumns, linkOf, loadAdminCalendar, loadPublicCalendar, toEntryRow } from "../lib/calendar.js";

// The brewery calendar. Reading it needs no sign-in; changing it needs an admin, and every change is
// recorded in Activity. Music events are read in from the Music screens and are never changed here.

const NOT_FOUND = { error: "Not found" };
const BAD_FROM = { error: "That date is too far away." };
const isId = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

function fromOf(query: unknown, today: string): string | null {
  const from = (query as { from?: string }).from ?? today;
  return calendarFromAllowed(from, today) ? from : null;
}

export async function calendarRoutes(fastify: FastifyInstance) {
  // ---- Anyone: 7 days from a date (default today) --------------------------------------------------

  fastify.get("/public/calendar", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const today = easternToday(new Date());
    const from = fromOf(request.query, today);
    if (!from) {
      reply.status(400).send(BAD_FROM);
      return;
    }
    reply.send(await loadPublicCalendar(from, today));
  });

  // ---- Admins ---------------------------------------------------------------------------------------

  fastify.get("/calendar/entries", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    const today = easternToday(new Date());
    const from = fromOf(request.query, today);
    if (!from) {
      reply.status(400).send(BAD_FROM);
      return;
    }
    reply.send(await loadAdminCalendar(from, today));
  });

  fastify.get("/calendar/entries/:id", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    const { id } = request.params as { id: string };
    const row = isId(id) ? await db.query.calendarEntries.findFirst({ where: eq(calendarEntries.id, id) }) : undefined;
    if (!row) {
      reply.status(404).send(NOT_FOUND);
      return;
    }
    const exceptions = await db.select().from(calendarExceptions).where(eq(calendarExceptions.entryId, id));
    const detail: AdminCalendarEntryDetail = {
      ...toEntryRow(row),
      cancelledDays: exceptions.filter((e) => e.cancelled).map((e) => e.exceptionDate).sort(),
      changedDays: exceptions
        .filter((e) => !e.cancelled)
        .map((e) => ({
          date: e.exceptionDate,
          title: e.title,
          startTime: e.startTime ? e.startTime.slice(0, 5) : null,
          endTime: e.endTime ? e.endTime.slice(0, 5) : null,
          type: e.type as CalendarType | null,
          note: e.note,
          link: linkOf(e),
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    };
    reply.send(detail);
  });

  fastify.post("/calendar/entries", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const body = parseBody(entrySchema, request.body, reply);
    if (!body) return;
    const actor = actorOf(session);
    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(calendarEntries)
        .values({
          title: body.title,
          entryDate: body.date,
          startTime: body.startTime ?? null,
          endTime: body.endTime ?? null,
          type: body.type,
          note: body.note?.trim() || null,
          ...linkColumns(body.link),
          repeat: body.repeat,
          repeatUntil: body.repeat === "none" ? null : (body.repeatUntil ?? null),
        })
        .returning();
      await recordActivity(tx, actor, {
        kind: "calendar_entry_added",
        summary: `${actor.name} added "${body.title}" to the calendar for ${formatEventDayLong(body.date)} (${REPEAT_TEXT[body.repeat].toLowerCase()}).`,
      });
      return row!;
    });
    reply.status(201).send({ id: created.id });
  });

  /** Change every day of an entry. Days that were changed on their own keep their changes. */
  fastify.patch("/calendar/entries/:id", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    if (!isId(id)) {
      reply.status(404).send(NOT_FOUND);
      return;
    }
    const body = parseBody(entrySchema, request.body, reply);
    if (!body) return;
    const actor = actorOf(session);
    const done = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(calendarEntries)
        .set({
          title: body.title,
          entryDate: body.date,
          startTime: body.startTime ?? null,
          endTime: body.endTime ?? null,
          type: body.type,
          note: body.note?.trim() || null,
          ...linkColumns(body.link),
          repeat: body.repeat,
          repeatUntil: body.repeat === "none" ? null : (body.repeatUntil ?? null),
        })
        .where(eq(calendarEntries.id, id))
        .returning();
      if (!row) return false;
      await recordActivity(tx, actor, {
        kind: "calendar_entry_changed",
        summary: `${actor.name} changed the calendar entry "${body.title}" (${REPEAT_TEXT[body.repeat].toLowerCase()}, from ${formatEventDayLong(body.date)}).`,
      });
      return true;
    });
    if (!done) {
      reply.status(404).send(NOT_FOUND);
      return;
    }
    reply.status(204).send();
  });

  /** Remove an entry and, with it, every one-day change to it. */
  fastify.delete("/calendar/entries/:id", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    if (!isId(id)) {
      reply.status(404).send(NOT_FOUND);
      return;
    }
    const actor = actorOf(session);
    const removed = await db.transaction(async (tx) => {
      const [row] = await tx.delete(calendarEntries).where(eq(calendarEntries.id, id)).returning();
      if (!row) return null;
      await recordActivity(tx, actor, { kind: "calendar_entry_removed", summary: `${actor.name} removed "${row.title}" from the calendar.` });
      return row;
    });
    if (!removed) {
      reply.status(404).send(NOT_FOUND);
      return;
    }
    reply.status(204).send();
  });

  // ---- One day of a repeating entry ----------------------------------------------------------------

  /** Finds a repeating entry and checks that it really happens on `date`. */
  async function dayTarget(id: string, date: string) {
    if (!isId(id)) return { ok: false as const, status: 404, error: "Not found" };
    if (!isRealDate(date)) return { ok: false as const, status: 400, error: "That isn't a real date." };
    const row = await db.query.calendarEntries.findFirst({ where: eq(calendarEntries.id, id) });
    if (!row) return { ok: false as const, status: 404, error: "Not found" };
    if (row.repeat === "none") return { ok: false as const, status: 400, error: "This entry doesn't repeat. Edit the entry itself." };
    if (!occursOn({ date: row.entryDate, repeat: row.repeat as never, repeatUntil: row.repeatUntil }, date)) {
      return { ok: false as const, status: 400, error: "That entry doesn't happen on that day." };
    }
    return { ok: true as const, row };
  }

  fastify.put("/calendar/entries/:id/days/:date", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id, date } = request.params as { id: string; date: string };
    const body = parseBody(dayDetailsSchema, request.body, reply);
    if (!body) return;
    const target = await dayTarget(id, date);
    if (!target.ok) {
      reply.status(target.status).send({ error: target.error });
      return;
    }
    const actor = actorOf(session);
    const values = {
      cancelled: false,
      title: body.title,
      startTime: body.startTime ?? null,
      endTime: body.endTime ?? null,
      type: body.type,
      note: body.note?.trim() || null,
      ...linkColumns(body.link),
    };
    await db.transaction(async (tx) => {
      await tx
        .insert(calendarExceptions)
        .values({ entryId: id, exceptionDate: date, ...values })
        .onConflictDoUpdate({ target: [calendarExceptions.entryId, calendarExceptions.exceptionDate], set: values });
      await recordActivity(tx, actor, {
        kind: "calendar_day_changed",
        summary: `${actor.name} changed "${target.row.title}" on ${formatEventDayLong(date)} only.`,
      });
    });
    reply.status(204).send();
  });

  /** Bring a cancelled day back exactly as the series defines it. */
  fastify.post("/calendar/entries/:id/days/:date/restore", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id, date } = request.params as { id: string; date: string };
    const target = await dayTarget(id, date);
    if (!target.ok) {
      reply.status(target.status).send({ error: target.error });
      return;
    }
    const actor = actorOf(session);
    const restored = await db.transaction(async (tx) => {
      const [row] = await tx
        .delete(calendarExceptions)
        .where(and(eq(calendarExceptions.entryId, id), eq(calendarExceptions.exceptionDate, date), eq(calendarExceptions.cancelled, true)))
        .returning();
      if (!row) return false;
      await recordActivity(tx, actor, {
        kind: "calendar_day_restored",
        summary: `${actor.name} restored "${target.row.title}" on ${formatEventDayLong(date)}.`,
      });
      return true;
    });
    if (!restored) {
      reply.status(400).send({ error: "That day wasn't cancelled." });
      return;
    }
    reply.status(204).send();
  });

  fastify.delete("/calendar/entries/:id/days/:date", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id, date } = request.params as { id: string; date: string };
    const target = await dayTarget(id, date);
    if (!target.ok) {
      reply.status(target.status).send({ error: target.error });
      return;
    }
    const actor = actorOf(session);
    const cleared = {
      cancelled: true,
      title: null,
      startTime: null,
      endTime: null,
      type: null,
      note: null,
      linkKind: null,
      linkTarget: null,
      linkLabel: null,
    };
    await db.transaction(async (tx) => {
      await tx
        .insert(calendarExceptions)
        .values({ entryId: id, exceptionDate: date, ...cleared })
        .onConflictDoUpdate({ target: [calendarExceptions.entryId, calendarExceptions.exceptionDate], set: cleared });
      await recordActivity(tx, actor, {
        kind: "calendar_day_cancelled",
        summary: `${actor.name} cancelled "${target.row.title}" on ${formatEventDayLong(date)} only.`,
      });
    });
    reply.status(204).send();
  });
}
