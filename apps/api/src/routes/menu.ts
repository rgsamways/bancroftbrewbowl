import type { FastifyInstance } from "fastify";
import { asc, eq, sql } from "drizzle-orm";
import {
  createMenuItemSchema,
  DRINK_SECTIONS,
  DRINK_SECTION_ORDER,
  menuAvailabilitySchema,
  updateMenuItemSchema,
  type MenuItem,
  type MenuKind,
  type MenuLabel,
  type MenuSection,
  type PublicMenu,
} from "@bbb/shared";
import { db } from "../db/client.js";
import { menuItems } from "../db/schema.js";
import { requireAdmin } from "../lib/guards.js";
import { actorOf, recordActivity } from "../lib/activity.js";
import { parseBody } from "../lib/validate.js";

// The menu. Reading it needs no sign-in (the table QR code opens it); changing it needs an
// admin, and every change is recorded in Activity. Nothing here touches money: a price is a
// number someone typed in.

const toItem = (row: typeof menuItems.$inferSelect): MenuItem => ({
  id: row.id,
  kind: row.kind as MenuKind,
  section: row.section,
  name: row.name,
  style: row.style,
  abv: row.abv,
  description: row.description,
  priceCents: row.priceCents,
  options: row.options,
  labels: row.labels as MenuLabel[],
  available: row.available,
});

/** The menu as the screens show it: drinks in their three fixed sections (always present, even
 * when empty), kitchen sections in the order each was first added. */
export async function loadMenu(): Promise<PublicMenu> {
  const rows = await db.query.menuItems.findMany({ orderBy: [asc(menuItems.sortOrder), asc(menuItems.createdAt)] });
  const drinks: MenuSection[] = DRINK_SECTION_ORDER.map((name) => ({ name, items: [] }));
  const kitchen: MenuSection[] = [];
  for (const row of rows) {
    const item = toItem(row);
    if (row.kind === "dish") {
      let section = kitchen.find((s) => s.name === row.section);
      if (!section) kitchen.push((section = { name: row.section, items: [] }));
      section.items.push(item);
    } else {
      drinks.find((s) => s.name === row.section)?.items.push(item);
    }
  }
  return { drinks, kitchen };
}

const cleanOptions = (options: { name: string; priceCents?: number | null }[]) =>
  options.map((o) => ({ name: o.name, priceCents: o.priceCents ?? null }));

const sectionFor = (kind: MenuKind, section: string | undefined) => (kind === "dish" ? section! : DRINK_SECTIONS[kind]);

const NOUN: Record<MenuKind, string> = { beer: "beer", wine: "wine", drink: "drink", dish: "dish" };

export async function menuRoutes(fastify: FastifyInstance) {
  // No sign-in. Always revalidated (the menu is small), so a sold-out switch shows the next time
  // anyone loads or reloads the page.
  fastify.get("/public/menu", async (_request, reply) => {
    reply.header("Cache-Control", "public, max-age=0, must-revalidate");
    reply.send(await loadMenu());
  });

  fastify.get("/menu/items", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;
    reply.send(await loadMenu());
  });

  fastify.post("/menu/items", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const body = parseBody(createMenuItemSchema, request.body, reply);
    if (!body) return;
    const actor = actorOf(session);

    const item = await db.transaction(async (tx) => {
      const [{ next }] = await tx.select({ next: sql<number>`coalesce(max(${menuItems.sortOrder}), 0)::int + 1` }).from(menuItems);
      const [created] = await tx
        .insert(menuItems)
        .values({
          kind: body.kind,
          section: sectionFor(body.kind, body.section),
          name: body.name,
          style: body.style,
          abv: body.abv,
          description: body.description,
          priceCents: body.priceCents,
          options: cleanOptions(body.options ?? []),
          labels: body.labels,
          sortOrder: next!,
        })
        .returning();
      await recordActivity(tx, actor, {
        kind: "menu_item_added",
        summary: `${actor.name} added the ${NOUN[body.kind]} "${body.name}" to the menu.`,
      });
      return created!;
    });
    reply.status(201).send(toItem(item));
  });

  fastify.patch("/menu/items/:id", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const body = parseBody(updateMenuItemSchema, request.body, reply);
    if (!body) return;
    const actor = actorOf(session);
    const { id } = request.params as { id: string };

    const before = await db.query.menuItems.findFirst({ where: eq(menuItems.id, id) });
    if (!before) {
      reply.status(404).send({ error: "Menu item not found" });
      return;
    }
    const kind = before.kind as MenuKind;
    if (body.kind && body.kind !== kind) {
      reply.status(400).send({ error: "A menu item's type can't be changed. Remove it and add it again." });
      return;
    }
    if (kind === "dish" && !body.section) {
      reply.status(400).send({ error: "A dish needs a section" });
      return;
    }

    const item = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(menuItems)
        .set({
          section: sectionFor(kind, body.section),
          name: body.name,
          style: body.style,
          abv: body.abv,
          description: body.description,
          priceCents: body.priceCents,
          options: cleanOptions(body.options ?? []),
          labels: body.labels,
        })
        .where(eq(menuItems.id, id))
        .returning();
      await recordActivity(tx, actor, {
        kind: "menu_item_changed",
        summary: `${actor.name} changed the ${NOUN[kind]} "${body.name}" on the menu.`,
      });
      return updated!;
    });
    reply.send(toItem(item));
  });

  fastify.patch("/menu/items/:id/availability", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const body = parseBody(menuAvailabilitySchema, request.body, reply);
    if (!body) return;
    const actor = actorOf(session);
    const { id } = request.params as { id: string };

    const item = await db.transaction(async (tx) => {
      const [updated] = await tx.update(menuItems).set({ available: body.available }).where(eq(menuItems.id, id)).returning();
      if (!updated) return null;
      await recordActivity(tx, actor, {
        kind: "menu_item_availability_changed",
        summary: `${actor.name} marked "${updated.name}" ${body.available ? (updated.kind === "dish" ? "available" : "back on tap") : "out"}.`,
      });
      return updated;
    });
    if (!item) {
      reply.status(404).send({ error: "Menu item not found" });
      return;
    }
    reply.send(toItem(item));
  });

  fastify.delete("/menu/items/:id", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const actor = actorOf(session);
    const { id } = request.params as { id: string };

    const removed = await db.transaction(async (tx) => {
      const [row] = await tx.delete(menuItems).where(eq(menuItems.id, id)).returning();
      if (!row) return null;
      await recordActivity(tx, actor, {
        kind: "menu_item_removed",
        summary: `${actor.name} removed the ${NOUN[row.kind as MenuKind]} "${row.name}" from the menu.`,
      });
      return row;
    });
    if (!removed) {
      reply.status(404).send({ error: "Menu item not found" });
      return;
    }
    reply.status(204).send();
  });
}
