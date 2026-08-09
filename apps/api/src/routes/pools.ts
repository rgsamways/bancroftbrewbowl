import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import { createPoolSchema, defaultRulesConfig, rulesConfigSchema, updatePoolRulesSchema } from "@bbb/shared";
import type { RulesConfig } from "@bbb/shared";
import { db } from "../db/client.js";
import { pools } from "../db/schema.js";
import { requireAdmin, requireSession } from "../lib/guards.js";
import { parseBody } from "../lib/validate.js";

export async function poolRoutes(fastify: FastifyInstance) {
  fastify.post("/pools", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;

    const body = parseBody(createPoolSchema, request.body, reply);
    if (!body) return;

    const [pool] = await db
      .insert(pools)
      .values({
        name: body.name,
        seasonYear: body.season_year,
        rules: { ...defaultRulesConfig, ...body.rules },
      })
      .returning();

    reply.status(201).send(pool);
  });

  fastify.get("/pools", async (request, reply) => {
    if (!(await requireSession(request, reply))) return;

    const allPools = await db.query.pools.findMany({ orderBy: [desc(pools.createdAt)] });
    reply.send(allPools);
  });

  fastify.get("/pools/:poolId", async (request, reply) => {
    const { poolId } = request.params as { poolId: string };
    const pool = await db.query.pools.findFirst({ where: eq(pools.id, poolId) });
    if (!pool) {
      reply.status(404).send({ error: "Pool not found" });
      return;
    }
    reply.send(pool);
  });

  fastify.patch("/pools/:poolId/rules", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;

    const { poolId } = request.params as { poolId: string };
    const body = parseBody(updatePoolRulesSchema, request.body, reply);
    if (!body) return;

    const pool = await db.query.pools.findFirst({ where: eq(pools.id, poolId) });
    if (!pool) {
      reply.status(404).send({ error: "Pool not found" });
      return;
    }

    const mergedRules = rulesConfigSchema.parse({ ...(pool.rules as RulesConfig), ...body });
    const [updated] = await db.update(pools).set({ rules: mergedRules }).where(eq(pools.id, poolId)).returning();
    reply.send(updated);
  });
}
