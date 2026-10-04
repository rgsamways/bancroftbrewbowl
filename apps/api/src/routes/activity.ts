import type { FastifyInstance } from "fastify";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  ACTIVITY_FILTERS,
  ACTIVITY_KINDS,
  ACTIVITY_PAGE_SIZE,
  kindsForFilter,
  type ActivityEntry,
  type ActivityFilter,
  type ActivityPage,
} from "@bbb/shared";
import { db } from "../db/client.js";
import { adminActivity } from "../db/schema.js";
import { requireAdmin } from "../lib/guards.js";

// Read-only. There is deliberately no route that updates or deletes a record: the record of
// admin changes is permanent (a test proves it).

/** Microsecond-exact timestamp text, so a page boundary never skips or repeats rows that were
 * written together (one request can write several records with the same timestamp). */
const cursorTs = sql<string>`to_char(${adminActivity.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

export async function activityRoutes(fastify: FastifyInstance) {
  fastify.get("/admin/activity", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;

    const { filter: rawFilter, before } = request.query as { filter?: string; before?: string };
    const filter = (ACTIVITY_FILTERS as readonly string[]).includes(rawFilter ?? "")
      ? (rawFilter as ActivityFilter)
      : "everything";

    const conditions = [];
    if (filter === "own") {
      // Changes the viewing admin made that touched their own entry.
      conditions.push(eq(adminActivity.affectsOwnEntry, true), eq(adminActivity.actorId, session.user.id));
    } else if (filter === "standings" || filter === "menu") {
      const kinds = kindsForFilter(filter);
      if (kinds.length === 0) {
        const empty: ActivityPage = { entries: [], nextBefore: null };
        reply.send(empty);
        return;
      }
      conditions.push(inArray(adminActivity.kind, kinds));
    }
    if (before) {
      const [ts, id] = before.split("|");
      if (!ts || !id || Number.isNaN(Date.parse(ts))) {
        reply.status(400).send({ error: "Invalid cursor" });
        return;
      }
      conditions.push(sql`(${adminActivity.createdAt}, ${adminActivity.id}) < (${ts}::timestamptz, ${id}::uuid)`);
    }

    const rows = await db
      .select({ row: adminActivity, cursor: cursorTs })
      .from(adminActivity)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(adminActivity.createdAt), desc(adminActivity.id))
      .limit(ACTIVITY_PAGE_SIZE + 1);

    const page = rows.slice(0, ACTIVITY_PAGE_SIZE);
    const body: ActivityPage = {
      entries: page.map(({ row }): ActivityEntry => ({
        id: row.id,
        kind: row.kind,
        title: (ACTIVITY_KINDS as Record<string, { title: string }>)[row.kind]?.title ?? "Changed something",
        summary: row.summary,
        actorName: row.actorName,
        actorId: row.actorId,
        poolId: row.poolId,
        affectsOwnEntry: row.affectsOwnEntry,
        createdAt: new Date(row.createdAt).toISOString(),
      })),
      nextBefore: rows.length > ACTIVITY_PAGE_SIZE ? `${page[page.length - 1]!.cursor}|${page[page.length - 1]!.row.id}` : null,
    };
    reply.send(body);
  });
}
