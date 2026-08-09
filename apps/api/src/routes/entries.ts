import type { FastifyInstance } from "fastify";
import { and, asc, eq } from "drizzle-orm";
import { createEntrySchema } from "@bbb/shared";
import { db } from "../db/client.js";
import { entries, user } from "../db/schema.js";
import { requireAdmin, requireSession } from "../lib/guards.js";
import { parseBody } from "../lib/validate.js";

type EntryRow = {
  id: string;
  poolId: string;
  status: "alive" | "eliminated";
  eliminatedWeek: number | null;
  createdAt: Date;
  invitedName: string | null;
  invitedEmail: string | null;
  user: { name: string; email: string } | null;
};

/** Resolves an entry's public shape — name/email always come from the linked
 * account when one exists, falling back to the admin's invite details until
 * that person signs in and the entry gets claimed. */
export function resolveEntry(entry: EntryRow) {
  return {
    id: entry.id,
    poolId: entry.poolId,
    displayName: entry.user?.name ?? entry.invitedName ?? "Unknown",
    email: entry.user?.email ?? entry.invitedEmail ?? "",
    status: entry.status,
    eliminatedWeek: entry.eliminatedWeek,
    createdAt: entry.createdAt,
  };
}

export async function entryRoutes(fastify: FastifyInstance) {
  fastify.post("/pools/:poolId/entries", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;

    const { poolId } = request.params as { poolId: string };
    const body = parseBody(createEntrySchema, request.body, reply);
    if (!body) return;

    const existingUser = await db.query.user.findFirst({ where: eq(user.email, body.email) });

    const existingEntry = await db.query.entries.findFirst({
      where: and(
        eq(entries.poolId, poolId),
        existingUser ? eq(entries.userId, existingUser.id) : eq(entries.invitedEmail, body.email)
      ),
    });
    if (existingEntry) {
      reply.send(resolveEntry({ ...existingEntry, user: existingUser ?? null }));
      return;
    }

    const [entry] = await db
      .insert(entries)
      .values(
        existingUser
          ? { poolId, userId: existingUser.id }
          : { poolId, invitedEmail: body.email, invitedName: body.display_name }
      )
      .returning();

    reply.status(201).send(resolveEntry({ ...entry, user: existingUser ?? null }));
  });

  fastify.post("/pools/:poolId/join", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const { poolId } = request.params as { poolId: string };

    const existing = await db.query.entries.findFirst({
      where: and(eq(entries.poolId, poolId), eq(entries.userId, session.user.id)),
    });
    if (existing) {
      reply.send(resolveEntry({ ...existing, user: session.user }));
      return;
    }

    const [entry] = await db.insert(entries).values({ poolId, userId: session.user.id }).returning();

    reply.status(201).send(resolveEntry({ ...entry, user: session.user }));
  });

  fastify.get("/me/entries", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const myEntries = await db.query.entries.findMany({
      where: eq(entries.userId, session.user.id),
      orderBy: [asc(entries.createdAt)],
      with: { pool: true, user: true },
    });
    reply.send(myEntries.map((entry) => ({ ...resolveEntry(entry), pool: entry.pool })));
  });

  fastify.get("/pools/:poolId/entries", async (request, reply) => {
    if (!(await requireSession(request, reply))) return;

    const { poolId } = request.params as { poolId: string };
    const poolEntries = await db.query.entries.findMany({
      where: eq(entries.poolId, poolId),
      orderBy: [asc(entries.createdAt)],
      with: { user: true },
    });
    reply.send(poolEntries.map(resolveEntry));
  });

  fastify.patch("/entries/:entryId", async (request, reply) => {
    if (!(await requireAdmin(request, reply))) return;

    const { entryId } = request.params as { entryId: string };
    const body = request.body as Partial<{ status: "alive" | "eliminated"; eliminatedWeek: number | null }>;

    const [entry] = await db.update(entries).set(body).where(eq(entries.id, entryId)).returning();

    if (!entry) {
      reply.status(404).send({ error: "Entry not found" });
      return;
    }
    const linkedUser = entry.userId ? await db.query.user.findFirst({ where: eq(user.id, entry.userId) }) : null;
    reply.send(resolveEntry({ ...entry, user: linkedUser ?? null }));
  });
}
