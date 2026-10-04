import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { validateNewPassword } from "@bbb/shared";
import { auth } from "../auth.js";
import { db } from "../db/client.js";
import { account } from "../db/schema.js";
import { requireSession } from "../lib/guards.js";

async function hasCredentialPassword(userId: string) {
  const row = await db.query.account.findFirst({
    where: and(eq(account.userId, userId), eq(account.providerId, "credential")),
  });
  return Boolean(row?.password);
}

export async function passwordRoutes(fastify: FastifyInstance) {
  // Only says whether the caller themselves has a password.
  fastify.get("/me/password", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;
    reply.send({ hasPassword: await hasCredentialPassword(session.user.id) });
  });

  // A first password, for someone signed in by link. Changing an existing one goes
  // through the library's change-password, which asks for the current password.
  fastify.post("/me/password", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;

    const { newPassword } = (request.body ?? {}) as { newPassword?: unknown };
    const problem = typeof newPassword === "string" ? validateNewPassword(newPassword) : "Please enter a new password.";
    if (problem || typeof newPassword !== "string") {
      reply.status(400).send({ error: problem, code: "INVALID_PASSWORD_FORMAT" });
      return;
    }
    if (await hasCredentialPassword(session.user.id)) {
      reply.status(409).send({ error: "A password is already set.", code: "PASSWORD_ALREADY_SET" });
      return;
    }

    const ctx = await auth.$context;
    await ctx.internalAdapter.linkAccount({
      userId: session.user.id,
      providerId: "credential",
      accountId: session.user.id,
      password: await ctx.password.hash(newPassword),
    });
    reply.status(204).send();
  });
}
