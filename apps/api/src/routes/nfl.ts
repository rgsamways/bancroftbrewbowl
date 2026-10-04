import type { FastifyInstance } from "fastify";
import { and, asc, desc, eq, min, sql } from "drizzle-orm";
import { enterGameResultSchema, updateGameScoreSchema } from "@bbb/shared";
import { db } from "../db/client.js";
import { games } from "../db/schema.js";
import { requireAdmin } from "../lib/guards.js";
import { parseBody } from "../lib/validate.js";
import { scoreGame } from "../lib/scoring.js";
import { actorOf, gameLabel, ownEntryChanged, ownEntryStatuses, recordActivity, resultText } from "../lib/activity.js";

export async function nflRoutes(fastify: FastifyInstance) {
  // Every season a game exists for — purely informational (drives the
  // season filter on the Schedule page and the season dropdown when
  // creating a pool). There's no persisted "current season" setting: it
  // would be one accidental edit away from silently changing what a new
  // pool defaults to, or which season the Schedule page opens on, for
  // reasons unrelated to whoever just edited it.
  fastify.get("/nfl/seasons", async (_request, reply) => {
    const rows = await db.selectDistinct({ seasonYear: games.seasonYear }).from(games).orderBy(desc(games.seasonYear));
    reply.send(rows.map((row) => row.seasonYear));
  });

  fastify.get("/nfl/weeks", async (request, reply) => {
    const { year } = request.query as { year?: string };
    if (!year) {
      reply.status(400).send({ error: "year is required" });
      return;
    }

    const rows = await db
      .select({
        weekNumber: games.weekNumber,
        pickDeadline: min(games.kickoffTime),
        pendingCount: sql<number>`count(*) filter (where ${games.result} = 'pending')`,
      })
      .from(games)
      .where(eq(games.seasonYear, Number(year)))
      .groupBy(games.weekNumber)
      .orderBy(asc(games.weekNumber));

    const now = new Date();
    reply.send(
      rows
        .filter((row) => row.pickDeadline)
        .map((row) => ({
          weekNumber: row.weekNumber,
          pickDeadline: row.pickDeadline,
          locked: now >= new Date(row.pickDeadline!),
          // Distinct from `locked`: a week locks at its first kickoff but
          // keeps playing games through Sunday/Monday, so "locked" alone
          // makes the next week look "current" while this one is still
          // being played out.
          completed: Number(row.pendingCount) === 0,
        }))
    );
  });

  fastify.get("/nfl/games", async (request, reply) => {
    const { year, week } = request.query as { year?: string; week?: string };
    if (!year) {
      reply.status(400).send({ error: "year is required" });
      return;
    }

    const rows = await db.query.games.findMany({
      where: week
        ? and(eq(games.seasonYear, Number(year)), eq(games.weekNumber, Number(week)))
        : eq(games.seasonYear, Number(year)),
      orderBy: [asc(games.weekNumber), asc(games.kickoffTime)],
    });
    reply.send(rows);
  });

  fastify.post("/nfl/games/:gameId/result", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;

    const { gameId } = request.params as { gameId: string };
    const body = parseBody(enterGameResultSchema, request.body, reply);
    if (!body) return;

    const existing = await db.query.games.findFirst({ where: eq(games.id, gameId) });
    if (!existing) {
      reply.status(404).send({ error: "Game not found" });
      return;
    }
    const actor = actorOf(session);
    const ownBefore = await ownEntryStatuses(db, actor.id);

    const [game] = await db
      .update(games)
      .set({ result: body.result, enteredBy: session.user.id, enteredAt: new Date() })
      .where(eq(games.id, gameId))
      .returning();

    if (!game) {
      reply.status(404).send({ error: "Game not found" });
      return;
    }

    const scoring = await scoreGame(gameId);

    // Written right after the result is saved and scored (scoring runs its own transactions).
    // If this fails the request errors, so a result is never silently left unrecorded.
    const ownAfter = await ownEntryStatuses(db, actor.id);
    const entered = existing.result === "pending";
    await recordActivity(db, actor, {
      kind: entered ? "result_entered" : "result_changed",
      summary: `${actor.name} ${entered ? "entered" : "changed"} a result: ${gameLabel(game)}, ${resultText(game, game.result)}.`,
      affectsOwnEntry: ownEntryChanged(ownBefore, ownAfter),
    });
    reply.send({ game, scoring });
  });

  fastify.patch("/nfl/games/:gameId/score", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;

    const { gameId } = request.params as { gameId: string };
    const body = parseBody(updateGameScoreSchema, request.body, reply);
    if (!body) return;

    const updates: Partial<{ homeScore: number; awayScore: number }> = {};
    if (body.home_score !== undefined) updates.homeScore = body.home_score;
    if (body.away_score !== undefined) updates.awayScore = body.away_score;

    const [game] = await db.update(games).set(updates).where(eq(games.id, gameId)).returning();

    if (!game) {
      reply.status(404).send({ error: "Game not found" });
      return;
    }
    const scoreText =
      game.homeScore !== null && game.awayScore !== null
        ? `${gameLabel(game)}, ${game.homeScore}–${game.awayScore}`
        : gameLabel(game);
    await recordActivity(db, actorOf(session), {
      kind: "score_updated",
      summary: `${session.user.name} updated the score: ${scoreText}.`,
    });
    reply.send(game);
  });
}
