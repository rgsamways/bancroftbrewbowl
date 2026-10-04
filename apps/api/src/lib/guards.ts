import type { FastifyReply, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { entries } from "../db/schema.js";
import { getSession } from "./auth-plugin.js";

export async function requireSession(request: FastifyRequest, reply: FastifyReply) {
  const session = await getSession(request);
  if (!session) {
    reply.status(401).send({ error: "Not authenticated" });
    return null;
  }
  return session;
}

/**
 * For anything that changes a pick: the signed-in person must own the entry.
 *
 * Admins are deliberately not exempt. An admin who also plays must not be able
 * to change anyone else's picks, so there is no override here. An entry nobody
 * has claimed yet (added by an admin, never signed in to) has no owner, so it
 * refuses everyone until its person signs in.
 *
 * Order of answers: not signed in (401), no such entry (404), not yours (403).
 */
export async function requireEntryOwner(request: FastifyRequest, reply: FastifyReply, entryId: string) {
  const session = await requireSession(request, reply);
  if (!session) return null;

  const entry = await db.query.entries.findFirst({ where: eq(entries.id, entryId) });
  if (!entry) {
    reply.status(404).send({ error: "Entry not found" });
    return null;
  }
  if (!entry.userId || entry.userId !== session.user.id) {
    reply.status(403).send({ error: "You can only change your own picks." });
    return null;
  }
  return { session, entry };
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const session = await requireSession(request, reply);
  if (!session) return null;
  if (!session.user.isAdmin) {
    reply.status(403).send({ error: "Admin access required" });
    return null;
  }
  return session;
}
