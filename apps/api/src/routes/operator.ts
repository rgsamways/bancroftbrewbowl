import type { FastifyInstance } from "fastify";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.js";
import { account, session as sessionTable, user } from "../db/schema.js";
import { requireOperator } from "../lib/guards.js";
import { parseBody } from "../lib/validate.js";
import { actorOf, recordActivity } from "../lib/activity.js";
import { EspnError } from "../lib/espn.js";
import { isOperatorAddress } from "../lib/operator.js";
import { applyScheduleLoad, previewScheduleLoad } from "../lib/schedule-load.js";

// Site setup: the three jobs that used to be terminal scripts. The god-user only (see lib/operator.ts).
// Every write records who did it in Activity.

const seasonSchema = z.number().int().min(2000).max(3000);
const loadSchema = z.object({ season: seasonSchema }).strict();
const emailSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) }).strict();

const ESPN_DOWN = "We couldn't reach ESPN right now. Nothing was changed. Try again in a little while.";

export async function operatorRoutes(fastify: FastifyInstance) {
  // ---- Schedule ---------------------------------------------------------------------------

  fastify.get("/operator/schedule", async (request, reply) => {
    if (!(await requireOperator(request, reply))) return;
    const season = seasonSchema.safeParse(Number((request.query as { season?: string }).season));
    if (!season.success) {
      reply.status(400).send({ error: "Choose a season, like 2026." });
      return;
    }
    try {
      reply.send(await previewScheduleLoad(season.data));
    } catch (e) {
      if (e instanceof EspnError) {
        reply.status(502).send({ error: ESPN_DOWN });
        return;
      }
      throw e;
    }
  });

  fastify.post("/operator/schedule", async (request, reply) => {
    const session = await requireOperator(request, reply);
    if (!session) return;
    const body = parseBody(loadSchema, request.body, reply);
    if (!body) return;
    const actor = actorOf(session);
    try {
      const outcome = await applyScheduleLoad(body.season);
      if (outcome.added > 0 || outcome.moved.length > 0) {
        await recordActivity(db, actor, {
          kind: "schedule_loaded",
          summary: `${actor.name} loaded the ${body.season} NFL schedule from ESPN: ${outcome.added} game${outcome.added === 1 ? "" : "s"} added, ${outcome.moved.length} kickoff${outcome.moved.length === 1 ? "" : "s"} updated.`,
        });
      }
      reply.send(outcome);
    } catch (e) {
      if (e instanceof EspnError) {
        reply.status(502).send({ error: ESPN_DOWN });
        return;
      }
      throw e;
    }
  });

  // ---- Admins -----------------------------------------------------------------------------

  const adminRow = (u: typeof user.$inferSelect) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    isOperator: isOperatorAddress(u.email),
  });

  fastify.get("/operator/admins", async (request, reply) => {
    if (!(await requireOperator(request, reply))) return;
    const rows = await db.select().from(user).where(eq(user.isAdmin, true)).orderBy(asc(user.name));
    reply.send(rows.map(adminRow));
  });

  fastify.post("/operator/admins", async (request, reply) => {
    const session = await requireOperator(request, reply);
    if (!session) return;
    const body = parseBody(emailSchema, request.body, reply);
    if (!body) return;
    const found = await db.query.user.findFirst({ where: sql`lower(${user.email}) = ${body.email}` });
    if (!found) {
      reply.status(404).send({ error: "They need to sign in once first, then you can make them an admin.", code: "NO_ACCOUNT" });
      return;
    }
    if (found.isAdmin) {
      reply.status(200).send({ ...adminRow(found), alreadyAdmin: true });
      return;
    }
    const actor = actorOf(session);
    const [updated] = await db.update(user).set({ isAdmin: true }).where(eq(user.id, found.id)).returning();
    await recordActivity(db, actor, { kind: "admin_added", summary: `${actor.name} made ${found.name} an admin.` });
    reply.status(201).send(adminRow(updated!));
  });

  fastify.delete("/operator/admins/:userId", async (request, reply) => {
    const session = await requireOperator(request, reply);
    if (!session) return;
    const { userId } = request.params as { userId: string };
    const found = await db.query.user.findFirst({ where: eq(user.id, userId) });
    if (!found || !found.isAdmin) {
      reply.status(404).send({ error: "That person isn't an admin." });
      return;
    }
    if (isOperatorAddress(found.email)) {
      reply.status(409).send({ error: "This account is the site owner's and can't be removed here." });
      return;
    }
    const [{ admins }] = await db.select({ admins: sql<number>`count(*)::int` }).from(user).where(eq(user.isAdmin, true));
    if ((admins ?? 0) <= 1) {
      reply.status(409).send({ error: "You can't remove the last admin." });
      return;
    }
    const actor = actorOf(session);
    await db.update(user).set({ isAdmin: false }).where(eq(user.id, found.id));
    await recordActivity(db, actor, { kind: "admin_removed", summary: `${actor.name} removed ${found.name}'s admin access.` });
    reply.send({ id: found.id });
  });

  // ---- Help someone sign in ---------------------------------------------------------------

  fastify.get("/operator/users", async (request, reply) => {
    if (!(await requireOperator(request, reply))) return;
    const parsed = emailSchema.safeParse({ email: (request.query as { email?: string }).email });
    if (!parsed.success) {
      reply.status(400).send({ error: "Type the person's email address." });
      return;
    }
    const found = await db.query.user.findFirst({ where: sql`lower(${user.email}) = ${parsed.data.email}` });
    if (!found) {
      reply.status(404).send({ error: "No account has that email. They need to sign in by link once first." });
      return;
    }
    const credential = await db.query.account.findFirst({
      where: and(eq(account.userId, found.id), eq(account.providerId, "credential")),
    });
    reply.send({ id: found.id, name: found.name, email: found.email, hasPassword: Boolean(credential?.password) });
  });

  fastify.post("/operator/players/:userId/sign-in-reset", async (request, reply) => {
    const session = await requireOperator(request, reply);
    if (!session) return;
    const { userId } = request.params as { userId: string };
    if (userId === session.user.id) {
      reply.status(400).send({ error: "Use the Me page for your own account." });
      return;
    }
    const found = await db.query.user.findFirst({ where: eq(user.id, userId) });
    if (!found) {
      reply.status(404).send({ error: "No such account." });
      return;
    }
    const actor = actorOf(session);
    // Sign them out everywhere and remove their password. No secret is created or shown: they sign in
    // with an emailed link, as every account can.
    await db.delete(sessionTable).where(eq(sessionTable.userId, found.id));
    await db.delete(account).where(and(eq(account.userId, found.id), eq(account.providerId, "credential")));
    await recordActivity(db, actor, {
      kind: "sign_in_reset",
      summary: `${actor.name} signed ${found.name} out everywhere and removed their password, so they sign in with an emailed link.`,
    });
    reply.send({ id: found.id });
  });
}
