import type { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
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
import { formatPoolTotal } from "@bbb/shared";
import { db } from "../db/client.js";
import { entries, pools } from "../db/schema.js";
import { actorOf, recordActivity } from "../lib/activity.js";
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
    const session = await requireAdmin(request, reply);
    if (!session) return;

    const body = parseBody(createPoolSchema, request.body, reply);
    if (!body) return;

    const type = body.type ?? "survivor";
    const rules = rulesSchemaForType(type).parse({ ...defaultRulesForType(type), ...body.rules });

    const actor = actorOf(session);
    const pool = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(pools)
        .values({
          name: body.name,
          seasonYear: body.season_year,
          type,
          rules,
        })
        .returning();
      await recordActivity(tx, actor, {
        kind: "pool_created",
        summary: `${actor.name} created ${body.name} (${type === "survivor" ? "Survivor" : "Pick 'em"}, ${body.season_year} season).`,
        poolId: created!.id,
      });
      return created!;
    });

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
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const actor = actorOf(session);

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
    // Allowed in any status: the total is not a rule, so it stays editable once rules lock.
    if (body.pool_total_cents !== undefined) updates.poolTotalCents = body.pool_total_cents;
    if (body.rules !== undefined) {
      updates.rules = rulesSchemaForType(pool.type).parse({
        ...(pool.rules as SurvivorRulesConfig | PickEmRulesConfig),
        ...body.rules,
      });
    }

    // One record per kind of change, so "changed only the total" says so and nothing else.
    const record: { kind: "pool_locked" | "pool_unlocked" | "pool_settings_changed" | "pool_total_changed"; summary: string }[] = [];
    if (updates.status !== undefined && updates.status !== pool.status) {
      if (pool.status === "draft" && updates.status === "active") {
        record.push({ kind: "pool_locked", summary: `${actor.name} locked the rules of ${pool.name}.` });
      } else if (pool.status === "active" && updates.status === "draft") {
        record.push({ kind: "pool_unlocked", summary: `${actor.name} unlocked the rules of ${pool.name}.` });
      } else {
        record.push({ kind: "pool_settings_changed", summary: `${actor.name} marked ${pool.name} as ${updates.status}.` });
      }
    }
    const settingsChanged =
      (updates.name !== undefined && updates.name !== pool.name) ||
      (updates.seasonYear !== undefined && updates.seasonYear !== pool.seasonYear) ||
      (updates.rules !== undefined && JSON.stringify(updates.rules) !== JSON.stringify(pool.rules));
    if (settingsChanged) {
      record.push({ kind: "pool_settings_changed", summary: `${actor.name} changed the settings of ${pool.name}.` });
    }
    if (updates.poolTotalCents !== undefined && updates.poolTotalCents !== pool.poolTotalCents) {
      record.push({
        kind: "pool_total_changed",
        summary:
          updates.poolTotalCents === null
            ? `${actor.name} cleared the pool total for ${pool.name}.`
            : `${actor.name} set the pool total for ${pool.name} to ${formatPoolTotal(updates.poolTotalCents)}.`,
      });
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx.update(pools).set(updates).where(eq(pools.id, poolId)).returning();
      for (const r of record) await recordActivity(tx, actor, { ...r, poolId });
      return row;
    });
    reply.send(updated);
  });

  fastify.delete("/pools/:poolId", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const actor = actorOf(session);

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

    const deleted = await db.transaction(async (tx) => {
      const ownEntries = await tx.query.entries.findMany({
        where: and(eq(entries.poolId, poolId), eq(entries.userId, actor.id)),
      });
      const [row] = await tx.delete(pools).where(eq(pools.id, poolId)).returning();
      // The pool is gone, so the record keeps its name in the sentence and has no pool link.
      await recordActivity(tx, actor, {
        kind: "pool_deleted",
        summary: `${actor.name} deleted ${pool.name}.`,
        affectsOwnEntry: ownEntries.length > 0,
      });
      return row;
    });
    reply.send(deleted);
  });
}
