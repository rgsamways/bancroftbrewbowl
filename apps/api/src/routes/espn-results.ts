import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdmin } from "../lib/guards.js";
import { parseBody } from "../lib/validate.js";
import { actorOf, gameLabel, recordActivity, resultText } from "../lib/activity.js";
import { db } from "../db/client.js";
import { EspnError } from "../lib/espn.js";
import { applyEspnResults, previewEspnResults } from "../lib/espn-results.js";

const applySchema = z.object({ gameIds: z.array(z.string().uuid()).min(1).max(60) }).strict();

const ESPN_DOWN = "We couldn't check ESPN right now. You can still enter results by hand below.";

/** "Check for results": admin only. Preview changes nothing; apply re-reads ESPN itself and scores
 * each saved game like a hand-entered result. Only ever runs when an admin asks. */
export async function espnResultsRoutes(fastify: FastifyInstance) {
  fastify.get("/admin/results/espn", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    try {
      reply.send(await previewEspnResults());
    } catch (e) {
      if (e instanceof EspnError) {
        reply.status(502).send({ error: ESPN_DOWN });
        return;
      }
      throw e;
    }
  });

  fastify.post("/admin/results/espn/apply", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const body = parseBody(applySchema, request.body, reply);
    if (!body) return;
    try {
      const actor = actorOf(session);
      const outcome = await applyEspnResults(body.gameIds, actor);
      // One record per import, written right after the results are saved and scored. An import
      // that changed nothing writes none.
      if (outcome.applied.length > 0) {
        const list = outcome.applied.map((g) => `${gameLabel(g)} ${resultText(g, g.result)}`).join("; ");
        await recordActivity(db, actor, {
          kind: "results_imported",
          summary: `${actor.name} imported ${outcome.applied.length} result${outcome.applied.length === 1 ? "" : "s"} from ESPN: ${list}.`,
          affectsOwnEntry: outcome.affectsOwnEntry,
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
}
