import { defaultPickEmRulesConfig, defaultSurvivorRulesConfig, type MeSummary, type PoolRecap, type PoolTv } from "@bbb/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { entries, games, picks } from "../db/schema.js";
import { cleanupFixtures, createEntry, createGame, createPick, createPool, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";

vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));

type User = Awaited<ReturnType<typeof createUser>>;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin });
const HOUR = 60 * 60 * 1000;
const at = (hours: number) => new Date(Date.now() + hours * HOUR);

describe("TV and recap", () => {
  let app: FastifyInstance;
  const poolIds: string[] = [];
  const gameIds: string[] = [];
  const userIds: string[] = [];
  let nextSeason = 2910;

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(async () => {
    await cleanupFixtures(poolIds.splice(0), gameIds.splice(0), userIds.splice(0));
  });

  const user = async (name: string) => {
    const u = await createUser({ name });
    userIds.push(u.id);
    return u;
  };
  const pool = async (type: "survivor" | "pick_em", season: number) => {
    const p =
      type === "survivor"
        ? await createPool("survivor", defaultSurvivorRulesConfig, season)
        : await createPool("pick_em", defaultPickEmRulesConfig, season);
    poolIds.push(p.id);
    return p;
  };
  const game = async (season: number, week: number, home: string, away: string, kickoff: Date, result?: "home_win" | "away_win" | "tie") => {
    const g = await createGame({ seasonYear: season, weekNumber: week, homeTeam: home, awayTeam: away, kickoffTime: kickoff });
    gameIds.push(g.id);
    if (result) await db.update(games).set({ result }).where(eq(games.id, g.id));
    return g;
  };
  const get = async <T>(viewer: User | null, url: string) => {
    actAs(viewer ? as(viewer) : null);
    const res = await app.inject({ method: "GET", url });
    return { status: res.statusCode, body: (res.json() as T), text: res.body };
  };

  describe("GET /pools/:id/tv", () => {
    it("refuses a signed-out request and an unknown pool", async () => {
      const p = await pool("survivor", nextSeason++);
      expect((await get(null, `/pools/${p.id}/tv`)).status).toBe(401);
      const v = await user("Viewer");
      expect((await get(v, `/pools/${crypto.randomUUID()}/tv`)).status).toBe(404);
    });

    it("survivor before the lock: alive names, status open, no pick counts", async () => {
      const season = nextSeason++;
      const p = await pool("survivor", season);
      const viewer = await user("Zed");
      await createEntry(p.id, viewer.id);
      const b = await createEntry(p.id, (await user("Beth")).id);
      await createEntry(p.id, (await user("aaron")).id);
      await game(season, 1, "KC", "BUF", at(24));
      await createPick(b.id, 1, "KC");

      const { status, body, text } = await get<PoolTv>(viewer, `/pools/${p.id}/tv`);
      expect(status).toBe(200);
      expect(body).toMatchObject({ status: "open", weekNumber: 1, playersTotal: 3, playersLeft: 3, alive: ["aaron", "Beth", "Zed"] });
      expect(body.mostPicked).toEqual([]);
      expect(text).not.toContain("@");
    });

    it("survivor after the lock: the three most picked with shares, still no individual picks", async () => {
      const season = nextSeason++;
      const p = await pool("survivor", season);
      const viewer = await user("Viewer");
      await game(season, 1, "KC", "BUF", at(-2));
      await game(season, 1, "DET", "NYJ", at(-1));
      const teams = ["KC", "KC", "KC", "DET", "DET", "NYJ", "BUF", "BUF"];
      for (const [i, t] of teams.entries()) {
        const e = await createEntry(p.id, (await user(`P${i}`)).id);
        await createPick(e.id, 1, t);
      }
      await createEntry(p.id, viewer.id); // did not pick: not in the denominator

      const { body, text } = await get<PoolTv>(viewer, `/pools/${p.id}/tv`);
      expect(body.status).toBe("locked");
      expect(body.mostPicked).toEqual([
        { team: "KC", picks: 3, sharePercent: 38 },
        { team: "BUF", picks: 2, sharePercent: 25 },
        { team: "DET", picks: 2, sharePercent: 25 },
      ]);
      expect(text).not.toContain("@");
      // Names are listed, but nothing ties a name to a team.
      expect(Object.keys(body).sort()).toEqual(["alive", "leaderboard", "mostPicked", "playersLeft", "playersTotal", "pool", "status", "weekNumber"]);
    });

    it("season_over when every game is decided", async () => {
      const season = nextSeason++;
      const p = await pool("survivor", season);
      const viewer = await user("Viewer");
      await game(season, 1, "KC", "BUF", at(-5), "home_win");
      expect((await get<PoolTv>(viewer, `/pools/${p.id}/tv`)).body.status).toBe("season_over");
    });

    it("pick 'em: the top 10 with shared ranks, no alive names", async () => {
      const season = nextSeason++;
      const p = await pool("pick_em", season);
      const viewer = await user("Viewer");
      await game(season, 1, "KC", "BUF", at(-5), "home_win");
      await game(season, 2, "DET", "NYJ", at(24));
      for (let i = 0; i < 12; i++) {
        const e = await createEntry(p.id, (await user(`Player ${String(i).padStart(2, "0")}`)).id);
        const pick = await createPick(e.id, 1, "KC");
        await db.update(picks).set({ result: i < 2 ? "win" : "loss" }).where(eq(picks.id, pick.id));
      }
      const { body } = await get<PoolTv>(viewer, `/pools/${p.id}/tv`);
      expect(body.alive).toEqual([]);
      expect(body.leaderboard).toHaveLength(10);
      expect(body.leaderboard[0]).toMatchObject({ points: 1, rank: 1, tied: true });
      expect(body.mostPicked).toEqual([]);
    });
  });

  describe("GET /pools/:id/recap", () => {
    // Week 3 decided: KC beat BUF, NYJ won at DET, PHI beat DAL. Week 4 still to play.
    const survivorWeek3 = async () => {
      const season = nextSeason++;
      const p = await pool("survivor", season);
      await game(season, 3, "KC", "BUF", at(-30), "home_win");
      await game(season, 3, "DET", "NYJ", at(-29), "away_win");
      await game(season, 3, "PHI", "DAL", at(-28), "home_win");
      await game(season, 4, "KC", "DET", at(48));
      const me = await user("Me");
      const mine = await createEntry(p.id, me.id);
      const pickedBy: Array<[typeof mine, string]> = [[mine, "KC"]];
      for (const t of ["KC", "KC", "DET", "PHI"]) pickedBy.push([await createEntry(p.id, (await user(`P-${t}-${pickedBy.length}`)).id), t]);
      for (const [e, t] of pickedBy) await createPick(e.id, 3, t);
      // The DET pick lost: out in week 3. A sixth player went out in week 1, a seventh in week 5.
      const out3 = pickedBy[3]![0];
      await db.update(entries).set({ status: "eliminated", eliminatedWeek: 3 }).where(eq(entries.id, out3.id));
      const out1 = await createEntry(p.id, (await user("Out One")).id);
      await db.update(entries).set({ status: "eliminated", eliminatedWeek: 1 }).where(eq(entries.id, out1.id));
      const out5 = await createEntry(p.id, (await user("Out Five")).id);
      await db.update(entries).set({ status: "eliminated", eliminatedWeek: 5 }).where(eq(entries.id, out5.id));
      return { p, me, mine };
    };

    it("refuses signed out, an unknown pool, an undecided week and a bad week", async () => {
      const { p, me } = await survivorWeek3();
      expect((await get(null, `/pools/${p.id}/recap`)).status).toBe(401);
      expect((await get(me, `/pools/${crypto.randomUUID()}/recap`)).status).toBe(404);
      expect((await get(me, `/pools/${p.id}/recap?week=4`)).status).toBe(404);
      expect((await get(me, `/pools/${p.id}/recap?week=nope`)).status).toBe(400);
    });

    it("survivor: players left, out this week, most picked, the upset and my own result", async () => {
      const { p, me, mine } = await survivorWeek3();
      const { status, body, text } = await get<PoolRecap>(me, `/pools/${p.id}/recap`);
      expect(status).toBe(200);
      expect(body).toMatchObject({
        week: 3,
        playersTotal: 7,
        // Alive now (4) plus the one that went out in week 5; the week 1 and week 3 exits are out.
        playersLeft: 5,
        playersOut: 1,
        mostPicked: { team: "KC", picks: 3, sharePercent: 60 },
        upset: { winner: "NYJ", loser: "DET" },
      });
      expect(body.you).toMatchObject({ entryId: mine.id, survived: true, picks: [{ team: "KC", result: "pending" }] });
      expect(text).not.toContain("@");
    });

    it("an explicit week works, and a pool with no picks has nothing to recap by default", async () => {
      const season = nextSeason++;
      const p = await pool("survivor", season);
      await game(season, 1, "KC", "BUF", at(-30), "home_win");
      const viewer = await user("Viewer");
      expect((await get(viewer, `/pools/${p.id}/recap`)).status).toBe(404);
      const { status, body } = await get<PoolRecap>(viewer, `/pools/${p.id}/recap?week=1`);
      expect(status).toBe(200);
      expect(body).toMatchObject({ week: 1, mostPicked: null, upset: null, you: null });
    });

    it("pick 'em: correct out of games, points, rank and the leader", async () => {
      const season = nextSeason++;
      const p = await pool("pick_em", season);
      await game(season, 1, "KC", "BUF", at(-30), "home_win");
      await game(season, 1, "DET", "NYJ", at(-29), "away_win");
      const me = await user("Me");
      const mine = await createEntry(p.id, me.id);
      const rival = await createEntry(p.id, (await user("Rival")).id);
      const set = async (entryId: string, team: string, result: "win" | "loss") => {
        const pick = await createPick(entryId, 1, team);
        await db.update(picks).set({ result }).where(eq(picks.id, pick.id));
      };
      await set(mine.id, "KC", "win");
      await set(mine.id, "DET", "loss");
      await set(rival.id, "KC", "win");
      await set(rival.id, "NYJ", "win");

      const { body } = await get<PoolRecap>(me, `/pools/${p.id}/recap`);
      expect(body.you).toMatchObject({ correct: 1, gamesTotal: 2, points: 1, rank: 2, tied: false });
      expect(body.leaderPoints).toBe(2);
      expect(body.mostPicked).toBeNull();
      expect(body.upset).toBeNull();
    });
  });

  it("GET /me/summary carries recapWeek: the latest decided week with picks, else null", async () => {
    const { me } = await survivorWeek3Summary();
    const { body } = await get<MeSummary>(me, "/me/summary");
    expect(body.entries[0]!.recapWeek).toBe(3);
  });

  it("recapWeek is null when no week has picks", async () => {
    const season = nextSeason++;
    const p = await pool("survivor", season);
    await game(season, 1, "KC", "BUF", at(-30), "home_win");
    const me = await user("Me");
    await createEntry(p.id, me.id);
    const { body } = await get<MeSummary>(me, "/me/summary");
    expect(body.entries[0]!.recapWeek).toBeNull();
  });

  async function survivorWeek3Summary() {
    const season = nextSeason++;
    const p = await pool("survivor", season);
    await game(season, 3, "KC", "BUF", at(-30), "home_win");
    await game(season, 4, "KC", "DET", at(48));
    const me = await user("Me");
    const mine = await createEntry(p.id, me.id);
    await createPick(mine.id, 3, "KC");
    return { me };
  }
});
