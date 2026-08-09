import type { FastifyInstance } from "fastify";
import { and, asc, eq } from "drizzle-orm";
import { createPromotionSchema, updatePromotionSchema } from "@bbb/shared";
import { db } from "../db/client.js";
import { promotions } from "../db/schema.js";
import { requireAdmin, requireSession } from "../lib/guards.js";
import { parseBody } from "../lib/validate.js";

export async function promotionRoutes(fastify: FastifyInstance) {
  fastify.get("/promotions", async (request, reply) => {
    if (!(await requireSession(request, reply))) return;

    const { year, week } = request.query as { year?: string; week?: string };
    const conditions = [];
    if (year) conditions.push(eq(promotions.seasonYear, Number(year)));
    if (week) conditions.push(eq(promotions.weekNumber, Number(week)));

    const rows = await db.query.promotions.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [asc(promotions.weekNumber), asc(promotions.createdAt)],
    });
    reply.send(rows);
  });

  fastify.post("/promotions", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;

    const body = parseBody(createPromotionSchema, request.body, reply);
    if (!body) return;

    const [promotion] = await db
      .insert(promotions)
      .values({
        seasonYear: body.season_year,
        weekNumber: body.week_number,
        title: body.title,
        description: body.description,
      })
      .returning();

    reply.status(201).send(promotion);
  });

  fastify.patch("/promotions/:promotionId", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;

    const { promotionId } = request.params as { promotionId: string };
    const body = parseBody(updatePromotionSchema, request.body, reply);
    if (!body) return;

    const updates: Partial<typeof promotions.$inferInsert> = {};
    if (body.season_year !== undefined) updates.seasonYear = body.season_year;
    if (body.week_number !== undefined) updates.weekNumber = body.week_number;
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;

    const [promotion] = await db
      .update(promotions)
      .set(updates)
      .where(eq(promotions.id, promotionId))
      .returning();

    if (!promotion) {
      reply.status(404).send({ error: "Promotion not found" });
      return;
    }
    reply.send(promotion);
  });

  fastify.delete("/promotions/:promotionId", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;

    const { promotionId } = request.params as { promotionId: string };
    const [deleted] = await db.delete(promotions).where(eq(promotions.id, promotionId)).returning();

    if (!deleted) {
      reply.status(404).send({ error: "Promotion not found" });
      return;
    }
    reply.send(deleted);
  });
}
