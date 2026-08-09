import type { FastifyInstance } from "fastify";
import { desc, eq } from "drizzle-orm";
import {
  createPoolSchema,
  updatePoolSchema,
  deletePoolSchema,
  survivorRulesConfigSchema,
  defaultSurvivorRulesConfig,
  pickEmRulesConfigSchema,
  defaultPickEmRulesConfig,
} from "@bbb/shared";
import type { SurvivorRulesConfig, PickEmRulesConfig, PoolType } from "@bbb/shared";
import { db } from "../db/client.js";
import { pools } from "../db/schema.js";
import { requireAdmin, requireSession } from "../lib/guards.js";
import { parseBody } from "../lib/validate.js";

function rulesSchemaForType(type: PoolType) {
  return type === "survivor" ? survivorRulesConfigSchema : pickEmRulesConfigSchema;
}

function defaultRulesForType(type: PoolType) {
  return type === "survivor" ? defaultSurvivorRulesConfig : defaultPickEmRulesConfig;
}

export async function poolRoutes(fastify: FastifyInstance) {
  fastify.post("/pools", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;

    const body = parseBody(createPoolSchema, request.body, reply);
    if (!body) return;

    const type = body.type ?? "survivor";
    const rules = rulesSchemaForType(type).parse({ ...defaultRulesForType(type), ...body.rules });

    const [pool] = await db
      .insert(pools)
      .values({
        name: body.name,
        seasonYear: body.season_year,
        type,
        rules,
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

  fastify.patch("/pools/:poolId", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;

    const { poolId } = request.params as { poolId: string };
    const body = parseBody(updatePoolSchema, request.body, reply);
    if (!body) return;

    const pool = await db.query.pools.findFirst({ where: eq(pools.id, poolId) });
    if (!pool) {
      reply.status(404).send({ error: "Pool not found" });
      return;
    }

    const updates: Partial<typeof pools.$inferInsert> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.season_year !== undefined) updates.seasonYear = body.season_year;
    if (body.status !== undefined) updates.status = body.status;
    if (body.rules !== undefined) {
      updates.rules = rulesSchemaForType(pool.type).parse({
        ...(pool.rules as SurvivorRulesConfig | PickEmRulesConfig),
        ...body.rules,
      });
    }

    const [updated] = await db.update(pools).set(updates).where(eq(pools.id, poolId)).returning();
    reply.send(updated);
  });

  fastify.delete("/pools/:poolId", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;

    const { poolId } = request.params as { poolId: string };
    const body = parseBody(deletePoolSchema, request.body, reply);
    if (!body) return;

    const pool = await db.query.pools.findFirst({ where: eq(pools.id, poolId) });
    if (!pool) {
      reply.status(404).send({ error: "Pool not found" });
      return;
    }
    if (body.confirm_name !== pool.name) {
      reply.status(400).send({ error: "Name does not match" });
      return;
    }

    const [deleted] = await db.delete(pools).where(eq(pools.id, poolId)).returning();
    reply.send(deleted);
  });
}
