import type { FastifyInstance } from "fastify";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  publicName,
  rankOf,
  type JoinablePool,
  type MeSummary,
  type PickEmRulesConfig,
  type PickSheet,
  type ScoreboardResponse,
  type SummaryEntry,
  type SurvivorRulesConfig,
} from "@bbb/shared";
import { db } from "../db/client.js";
import { entries, games, picks, pools } from "../db/schema.js";
import { requireEntryOwner, requireSession } from "../lib/guards.js";
import {
  currentWeek,
  deriveEntryState,
  loadSeasonWeeks,
  picksNeededFor,
  type EntryStateResult,
  type SeasonWeek,
  type WeekGameLite,
} from "../lib/entry-state.js";
import { isGameLocked, pickDeadlineRuleOf } from "../lib/pick-lock.js";
import { isAdminUser, isOperatorUser } from "../lib/operator.js";
import { getScoreboard } from "../lib/scoreboard.js";
import { loadBreweryHome } from "../lib/brewery.js";
import { latestRecapWeek, pickedWeeksByPool } from "../lib/recap.js";
import { computePickEmPoints } from "./entries.js";

type PoolRow = typeof pools.$inferSelect;

function doublePickWeeks(pool: PoolRow): number[] {
  return pool.type === "survivor" ? (pool.rules as SurvivorRulesConfig).double_pick_weeks : [];
}

function countsTie(pool: PoolRow) {
  return pool.type === "pick_em" && (pool.rules as PickEmRulesConfig).tie_handling === "everyone_correct";
}

/** The lock time to send: for a per-game pool the next lock that matters to the entry (null when
 * nothing can change), otherwise the week's first kickoff. */
function lockTimeOf(d: EntryStateResult): string | null {
  if (d.lockTime !== undefined) return d.lockTime ? d.lockTime.toISOString() : null;
  return d.week ? d.week.lockTime.toISOString() : null;
}

/** Home and the Pick screen each get everything they need in one request. */
export async function homeRoutes(fastify: FastifyInstance) {
  // What the signed-in person may reach, so the app can show the Admin tab and the site-setup screens.
  // The server still enforces every route itself.
  fastify.get("/me/access", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;
    reply.send({ isAdmin: isAdminUser(session.user), isOperator: isOperatorUser(session.user) });
  });

  // The NFL scoreboard for Home: one cached read of ESPN shared by everyone, plus the signed-in
  // player's own picks for the week (never anyone else's). When there is nothing to show it says so
  // rather than failing, so Home can simply leave the section out.
  fastify.get("/me/scoreboard", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;
    const shared = await getScoreboard();
    if (!shared || shared.games.length === 0) {
      const none: ScoreboardResponse = { scoreboard: null };
      reply.send(none);
      return;
    }

    const mine = await db.query.entries.findMany({
      where: and(eq(entries.userId, session.user.id), eq(entries.status, "alive")),
      with: { pool: true },
    });
    const current = mine.filter((e) => e.pool.seasonYear === shared.seasonYear && e.pool.status !== "completed");
    const myPicks =
      current.length > 0
        ? await db.query.picks.findMany({
            where: and(inArray(picks.entryId, current.map((e) => e.id)), eq(picks.weekNumber, shared.weekNumber)),
          })
        : [];
    const yourPicks = current
      .map((e) => ({ poolId: e.pool.id, poolName: e.pool.name, teams: myPicks.filter((p) => p.entryId === e.id).map((p) => p.teamCode) }))
      .filter((p) => p.teams.length > 0);

    const body: ScoreboardResponse = {
      scoreboard: {
        seasonYear: shared.seasonYear,
        weekNumber: shared.weekNumber,
        asOf: shared.asOf.toISOString(),
        stale: shared.stale,
        games: shared.games,
        byes: shared.byes,
        yourPicks,
      },
    };
    reply.send(body);
  });

  fastify.get("/me/summary", async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;
    const now = new Date();

    const mine = await db.query.entries.findMany({
      where: eq(entries.userId, session.user.id),
      orderBy: [asc(entries.createdAt)],
      with: { pool: true },
    });

    const joinedPoolIds = new Set(mine.map((e) => e.poolId));
    const openPools = await db.query.pools.findMany({ orderBy: [asc(pools.createdAt)] });
    const joinablePools: JoinablePool[] = openPools
      .filter((p) => p.status !== "completed" && !joinedPoolIds.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, type: p.type, seasonYear: p.seasonYear }));

    const brewery = await loadBreweryHome(now);

    if (mine.length === 0) {
      const empty: MeSummary = { serverNow: now.toISOString(), entries: [], joinablePools, brewery };
      reply.send(empty);
      return;
    }

    const poolIds = [...joinedPoolIds];
    const weeksBySeason = await loadSeasonWeeks([...new Set(mine.map((e) => e.pool.seasonYear))]);

    // Everyone in these pools: only counts, ranks and the champion's name leave the server.
    const poolEntries = await db.query.entries.findMany({
      where: inArray(entries.poolId, poolIds),
      with: { user: true },
    });
    const myPicks = await db.query.picks.findMany({ where: inArray(picks.entryId, mine.map((e) => e.id)) });

    const pointsByPool = new Map<string, Map<string, number>>();
    for (const pool of mine.map((e) => e.pool)) {
      if (pool.type !== "pick_em" || pointsByPool.has(pool.id)) continue;
      const ids = poolEntries.filter((e) => e.poolId === pool.id).map((e) => e.id);
      pointsByPool.set(
        pool.id,
        await computePickEmPoints(ids, (pool.rules as PickEmRulesConfig).tie_handling)
      );
    }

    const pickedWeeks = await pickedWeeksByPool(poolIds);

    // The current week's games for each season, for pools that lock each pick at its own game.
    const currentGames = new Map<number, WeekGameLite[]>();
    for (const [season, list] of weeksBySeason) {
      const cw = currentWeek(list);
      if (cw) currentGames.set(season, await db.select().from(games).where(and(eq(games.seasonYear, season), eq(games.weekNumber, cw.weekNumber))));
    }

    const nameOf = (e: (typeof poolEntries)[number]) => publicName(e.user?.name, e.invitedName);

    const summaryEntries: SummaryEntry[] = mine.map((entry) => {
      const pool = entry.pool;
      const weeks = weeksBySeason.get(pool.seasonYear);
      const entryPicks = myPicks.filter((p) => p.entryId === entry.id);
      const derived = deriveEntryState({
        entryStatus: entry.status,
        poolStatus: pool.status,
        weeks,
        picksMadeThisWeek: (w) => entryPicks.filter((p) => p.weekNumber === w).length,
        picksNeeded: (w: SeasonWeek) => picksNeededFor(pool.type, doublePickWeeks(pool), w),
        now,
        perGame:
          pickDeadlineRuleOf(pool) === "per_game_kickoff"
            ? (w) => ({
                poolType: pool.type,
                games: currentGames.get(pool.seasonYear) ?? [],
                pickTeams: entryPicks.filter((p) => p.weekNumber === w.weekNumber).map((p) => p.teamCode),
              })
            : undefined,
      });

      const inPool = poolEntries.filter((e) => e.poolId === pool.id);
      const points = pointsByPool.get(pool.id);
      const weekNumber = derived.week?.weekNumber ?? null;
      const thisWeekPicks = weekNumber === null ? [] : entryPicks.filter((p) => p.weekNumber === weekNumber);

      let champion: string | null = null;
      if (derived.state === "season_over") {
        if (pool.type === "survivor") {
          const alive = inPool.filter((e) => e.status === "alive");
          champion = alive.length === 1 ? nameOf(alive[0]!) : null;
        } else if (points) {
          const best = Math.max(...inPool.map((e) => points.get(e.id) ?? 0));
          const leaders = inPool.filter((e) => (points.get(e.id) ?? 0) === best);
          champion = leaders.length === 1 && inPool.length > 0 ? nameOf(leaders[0]!) : null;
        }
      }

      const myPoints = points?.get(entry.id) ?? 0;
      const ranked = points ? rankOf(myPoints, inPool.map((e) => points.get(e.id) ?? 0)) : null;

      return {
        entryId: entry.id,
        poolId: pool.id,
        poolName: pool.name,
        poolType: pool.type,
        seasonYear: pool.seasonYear,
        status: entry.status,
        eliminatedWeek: entry.eliminatedWeek,
        state: derived.state,
        weekNumber,
        lockTime: lockTimeOf(derived),
        lockRule: pickDeadlineRuleOf(pool) === "per_game_kickoff" ? "game" : "week",
        picksMade: derived.picksMade,
        picksNeeded: derived.picksNeeded,
        playersTotal: inPool.length,
        playersLeft: pool.type === "survivor" ? inPool.filter((e) => e.status === "alive").length : null,
        points: pool.type === "pick_em" ? myPoints : null,
        rank: ranked?.rank ?? null,
        tied: ranked?.tied ?? false,
        gamesTotal: pool.type === "pick_em" ? (derived.week?.gamesTotal ?? null) : null,
        correctThisWeek:
          pool.type === "pick_em"
            ? thisWeekPicks.filter((p) => p.result === "win" || (p.result === "tie" && countsTie(pool))).length
            : null,
        champion,
        recapWeek: latestRecapWeek(weeks, pickedWeeks.get(pool.id)),
      };
    });

    const body: MeSummary = { serverNow: now.toISOString(), entries: summaryEntries, joinablePools, brewery };
    reply.send(body);
  });

  fastify.get("/entries/:entryId/pick-sheet", async (request, reply) => {
    const { entryId } = request.params as { entryId: string };
    const owned = await requireEntryOwner(request, reply, entryId);
    if (!owned) return;
    const { entry } = owned;
    const now = new Date();

    const pool = await db.query.pools.findFirst({ where: eq(pools.id, entry.poolId) });
    if (!pool) {
      reply.status(404).send({ error: "Pool not found" });
      return;
    }

    const weeks = (await loadSeasonWeeks([pool.seasonYear])).get(pool.seasonYear);
    const entryPicks = await db.query.picks.findMany({
      where: eq(picks.entryId, entry.id),
      orderBy: [asc(picks.weekNumber), asc(picks.createdAt)],
    });
    const perGame = pickDeadlineRuleOf(pool) === "per_game_kickoff";
    // The current week's games (an eliminated entry or a finished season has no week to pick in; the
    // pick history is still returned).
    const nowWeek = currentWeek(weeks);
    const weekGames = nowWeek
      ? await db.query.games.findMany({
          where: and(eq(games.seasonYear, pool.seasonYear), eq(games.weekNumber, nowWeek.weekNumber)),
          orderBy: [asc(games.kickoffTime), asc(games.homeTeam)],
        })
      : [];
    const derived = deriveEntryState({
      entryStatus: entry.status,
      poolStatus: pool.status,
      weeks,
      picksMadeThisWeek: (w) => entryPicks.filter((p) => p.weekNumber === w).length,
      picksNeeded: (w) => picksNeededFor(pool.type, doublePickWeeks(pool), w),
      now,
      perGame: perGame
        ? (w) => ({
            poolType: pool.type,
            games: weekGames,
            pickTeams: entryPicks.filter((p) => p.weekNumber === w.weekNumber).map((p) => p.teamCode),
          })
        : undefined,
    });

    const week = derived.week;
    // An eliminated entry or a finished season has no week to pick in, so it is sent no games.
    const shownGames = week ? weekGames : [];
    const weekLocked = week ? now >= week.lockTime : false;
    const gameLocked = (g: WeekGameLite) => (perGame ? isGameLocked(g, now) : weekLocked);

    const usedTeams: Record<string, number> = {};
    for (const p of entryPicks) {
      if (p.weekNumber !== week?.weekNumber) usedTeams[p.teamCode] = p.weekNumber;
    }

    // A pick is locked when its week is over, or (this week) when its game has started (per-game
    // pools) or the week has locked (whole-week pools).
    const pickLocked = (p: (typeof entryPicks)[number]) => {
      if (!week || p.weekNumber < week.weekNumber) return true;
      if (p.weekNumber > week.weekNumber) return false;
      const g = weekGames.find((x) => x.homeTeam === p.teamCode || x.awayTeam === p.teamCode);
      return g ? gameLocked(g) : weekLocked;
    };

    const sheet: PickSheet = {
      serverNow: now.toISOString(),
      entryId: entry.id,
      poolId: pool.id,
      poolName: pool.name,
      poolType: pool.type,
      seasonYear: pool.seasonYear,
      status: entry.status,
      eliminatedWeek: entry.eliminatedWeek,
      state: derived.state,
      weekNumber: week?.weekNumber ?? null,
      lockTime: lockTimeOf(derived),
      lockRule: perGame ? "game" : "week",
      limit: derived.picksNeeded || 1,
      allowRepeatTeams: pool.type === "pick_em" || (pool.rules as SurvivorRulesConfig).allow_repeat_teams,
      games: shownGames.map((g) => ({
        id: g.id,
        homeTeam: g.homeTeam,
        awayTeam: g.awayTeam,
        kickoffTime: new Date(g.kickoffTime).toISOString(),
        result: g.result,
        locked: gameLocked(g),
      })),
      picks: entryPicks.map((p) => ({ weekNumber: p.weekNumber, teamCode: p.teamCode, result: p.result, locked: pickLocked(p) })),
      usedTeams,
    };
    reply.send(sheet);
  });
}
