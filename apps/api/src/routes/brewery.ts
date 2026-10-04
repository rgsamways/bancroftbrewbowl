import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  createAnnouncementSchema,
  createFeatureSchema,
  createSpecialSchema,
  easternToday,
  scheduleText,
} from "@bbb/shared";
import { db } from "../db/client.js";
import { menuItems, promotions } from "../db/schema.js";
import { requireAdmin } from "../lib/guards.js";
import { actorOf, recordActivity } from "../lib/activity.js";
import { parseBody } from "../lib/validate.js";
import { currentSeasonWeek, loadShowingNow } from "../lib/brewery.js";

// "From the brewery": what admins post for the Home screen. Nothing here is linked to standings,
// winning or losing; a special is just words, days and times. Every change is recorded in Activity.

const NO_WEEK = "There's no current week yet, so there's nothing to attach this to. Load the schedule first.";

export async function breweryRoutes(fastify: FastifyInstance) {
  fastify.get("/brewery/items", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    reply.send(await loadShowingNow());
  });

  fastify.post("/brewery/features", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const body = parseBody(createFeatureSchema, request.body, reply);
    if (!body) return;
    const actor = actorOf(session);

    const item = await db.query.menuItems.findFirst({ where: eq(menuItems.id, body.menuItemId) });
    if (!item) {
      reply.status(404).send({ error: "That menu item isn't on the menu any more." });
      return;
    }
    const now = body.scope === "week" ? await currentSeasonWeek() : null;
    if (body.scope === "week" && !now) {
      reply.status(409).send({ error: NO_WEEK });
      return;
    }

    const created = await db.transaction(async (tx) => {
      // One feature at a time: the new one replaces whatever was featured.
      await tx.delete(promotions).where(eq(promotions.kind, "feature"));
      const [row] = await tx
        .insert(promotions)
        .values({
          kind: "feature",
          menuItemId: item.id,
          title: item.name,
          description: "",
          seasonYear: now?.seasonYear ?? null,
          weekNumber: now?.weekNumber ?? null,
        })
        .returning();
      await recordActivity(tx, actor, {
        kind: "brewery_feature_set",
        summary: `${actor.name} featured "${item.name}" on Home ${body.scope === "week" ? "for this week" : "until it is changed"}.`,
      });
      return row!;
    });
    reply.status(201).send({ id: created.id });
  });

  fastify.post("/brewery/specials", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const parsed = parseBody(createSpecialSchema, request.body, reply);
    if (!parsed) return;
    const body = {
      title: parsed.title,
      details: parsed.details ?? null,
      tag: parsed.tag ?? null,
      days: parsed.days ?? null,
      date: parsed.date ?? null,
      startTime: parsed.startTime ?? null,
      endTime: parsed.endTime ?? null,
    };
    const actor = actorOf(session);

    if (body.date !== null && body.date < easternToday(new Date())) {
      reply.status(400).send({ error: "That date has already gone. Pick today or a later day." });
      return;
    }

    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(promotions)
        .values({
          kind: "special",
          title: body.title,
          description: body.details ?? "",
          tag: body.tag,
          days: body.days,
          onDate: body.date,
          startTime: body.startTime,
          endTime: body.endTime,
        })
        .returning();
      await recordActivity(tx, actor, {
        kind: "brewery_special_added",
        summary: `${actor.name} added the special "${body.title}" (${scheduleText(body)}).`,
      });
      return row!;
    });
    reply.status(201).send({ id: created.id });
  });

  fastify.post("/brewery/announcements", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const body = parseBody(createAnnouncementSchema, request.body, reply);
    if (!body) return;
    const actor = actorOf(session);

    const now = await currentSeasonWeek();
    if (!now) {
      reply.status(409).send({ error: NO_WEEK });
      return;
    }
    if (body.weekNumber < now.weekNumber) {
      reply.status(400).send({ error: `Week ${body.weekNumber} has already gone. Pick this week (${now.weekNumber}) or a later one.` });
      return;
    }

    const created = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(promotions)
        .values({
          kind: "announcement",
          title: body.title,
          description: body.message,
          seasonYear: now.seasonYear,
          weekNumber: body.weekNumber,
        })
        .returning();
      await recordActivity(tx, actor, {
        kind: "brewery_announcement_posted",
        summary: `${actor.name} posted the announcement "${body.title}" for week ${body.weekNumber}.`,
      });
      return row!;
    });
    reply.status(201).send({ id: created.id });
  });

  fastify.delete("/brewery/items/:id", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const actor = actorOf(session);
    const { id } = request.params as { id: string };
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      reply.status(404).send({ error: "Not found" });
      return;
    }

    const removed = await db.transaction(async (tx) => {
      const [row] = await tx.delete(promotions).where(eq(promotions.id, id)).returning();
      if (!row) return null;
      await recordActivity(tx, actor, {
        kind: "brewery_item_removed",
        summary: `${actor.name} removed the ${row.kind} "${row.title}" from Home.`,
      });
      return row;
    });
    if (!removed) {
      reply.status(404).send({ error: "Not found" });
      return;
    }
    reply.status(204).send();
  });
}
