import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { pools } from "../db/schema.js";
import { requireSession } from "../lib/guards.js";
import { buildPoolTv } from "../lib/pool-tv.js";

/** What the bar's TV shows for a pool, in one request (signed in). The content is built by
 * `lib/pool-tv.ts`, which the private TV screens share. */
export async function tvRoutes(fastify: FastifyInstance) {
  fastify.get("/pools/:poolId/tv", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const { poolId } = request.params as { poolId: string };
    const pool = await db.query.pools.findFirst({ where: eq(pools.id, poolId) });
    if (!pool) {
      reply.status(404).send({ error: "Pool not found" });
      return;
    }
    reply.send(await buildPoolTv(pool));
  });
}
