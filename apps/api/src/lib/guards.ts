import type { FastifyReply, FastifyRequest } from "fastify";
import { getSession } from "./auth-plugin.js";

export async function requireSession(request: FastifyRequest, reply: FastifyReply) {
  const session = await getSession(request);
  if (!session) {
    reply.status(401).send({ error: "Not authenticated" });
    return null;
  }
  return session;
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
