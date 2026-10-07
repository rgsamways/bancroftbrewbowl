import { defaultPickEmRulesConfig, defaultSurvivorRulesConfig, type MeSummary, type PickSheet } from "@bbb/shared";
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
const future = (hours: number) => new Date(Date.now() + hours * HOUR);

describe("home summary and pick sheet", () => {
  let app: FastifyInstance;
  const poolIds: string[] = [];
  const gameIds: string[] = [];
  const userIds: string[] = [];
  let nextSeason = 2970;

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(async () => {
    await cleanupFixtures(poolIds.splice(0), gameIds.splice(0), userIds.splice(0));
  });

  const user = async (name: string, isAdmin = false) => {
    const u = await createUser({ name, isAdmin });
    userIds.push(u.id);
    return u;
  };
  const pool = async (type: "survivor" | "pick_em", season: number, rules = {}) => {
    const p =
      type === "survivor"
        ? await createPool("survivor", { ...defaultSurvivorRulesConfig, ...rules }, season)
        : await createPool("pick_em", { ...defaultPickEmRulesConfig, ...rules }, season);
    poolIds.push(p.id);
    return p;
  };
  const game = async (season: number, week: number, home: string, away: string, kickoff: Date) => {
    const g = await createGame({ seasonYear: season, weekNumber: week, homeTeam: home, awayTeam: away, kickoffTime: kickoff });
    gameIds.push(g.id);
    return g;
  };
  const summary = async (u: User) => {
    actAs(as(u));
    const res = await app.inject({ method: "GET", url: "/me/summary" });
    expect(res.statusCode).toBe(200);
    return res.json() as MeSummary;
  };
  const sheet = async (u: User | null, entryId: string) => {
    actAs(u ? as(u) : null);
    return app.inject({ method: "GET", url: `/entries/${entryId}/pick-sheet` });
  };

  it("is refused when signed out", async () => {
    actAs(null);
    expect((await app.inject({ method: "GET", url: "/me/summary" })).statusCode).toBe(401);
  });

  it("a player in no pool gets no entries and the open pools to join", async () => {
    const season = nextSeason++;
    const p = await pool("survivor", season);
    const u = await user("Newcomer");
    const s = await summary(u);
    expect(s.entries).toEqual([]);
    expect(s.joinablePools.map((j) => j.id)).toContain(p.id);
  });

  it("survivor: needs picks, then picked, with counts and the lock time", async () => {
    const season = nextSeason++;
    const p = await pool("survivor", season);
    const me = await user("Me");
    const other = await user("Other");
    const out = await user("Out");
    const mine = await createEntry(p.id, me.id);
    await createEntry(p.id, other.id);
    const outEntry = await createEntry(p.id, out.id);
    await db.update(entries).set({ status: "eliminated", eliminatedWeek: 1 }).where(eq(entries.id, outEntry.id));
    const kickoff = future(48);
    await game(season, 1, "KC", "BUF", kickoff);

    let s = await summary(me);
    expect(s.entries).toHaveLength(1);
    let e = s.entries[0]!;
    expect(e).toMatchObject({
      entryId: mine.id,
      state: "needs_picks",
      weekNumber: 1,
      picksMade: 0,
      picksNeeded: 1,
      playersLeft: 2,
      playersTotal: 3,
      status: "alive",
    });
    expect(e.lockTime).toBe(kickoff.toISOString());
    expect(new Date(s.serverNow).getTime()).toBeLessThanOrEqual(Date.now());
    expect(s.joinablePools.map((j) => j.id)).not.toContain(p.id);

    await createPick(mine.id, 1, "KC");
    s = await summary(me);
    e = s.entries[0]!;
    expect(e.state).toBe("picked");
    expect(e.picksMade).toBe(1);
  });

  it("survivor: a double-pick week with one of two picks is still not picked", async () => {
    const season = nextSeason++;
    const p = await pool("survivor", season, { double_pick_weeks: [1] });
    const me = await user("Me");
    const mine = await createEntry(p.id, me.id);
    await game(season, 1, "KC", "BUF", future(24));
    await game(season, 1, "DAL", "PHI", future(25));
    await createPick(mine.id, 1, "KC");
    let e = (await summary(me)).entries[0]!;
    expect(e).toMatchObject({ state: "needs_picks", picksMade: 1, picksNeeded: 2 });
    await createPick(mine.id, 1, "DAL");
    e = (await summary(me)).entries[0]!;
    expect(e.state).toBe("picked");
  });

  it("survivor: locked after the first kickoff, even while the week is still being played", async () => {
    const season = nextSeason++;
    const p = await pool("survivor", season);
    const me = await user("Me");
    const mine = await createEntry(p.id, me.id);
    await game(season, 1, "KC", "BUF", future(-2));
    await game(season, 1, "DAL", "PHI", future(20));
    await createPick(mine.id, 1, "KC");
    expect((await summary(me)).entries[0]!.state).toBe("locked");
  });

  it("survivor: eliminated shows the week and no sign of lives", async () => {
    const season = nextSeason++;
    const p = await pool("survivor", season, { mulligans_allowed: 2 });
    const me = await user("Me");
    const mine = await createEntry(p.id, me.id);
    await db.update(entries).set({ status: "eliminated", eliminatedWeek: 3 }).where(eq(entries.id, mine.id));
    await game(season, 4, "KC", "BUF", future(24));
    const e = (await summary(me)).entries[0]!;
    expect(e).toMatchObject({ state: "eliminated", eliminatedWeek: 3, status: "eliminated" });
    expect(JSON.stringify(e)).not.toMatch(/mulligan/i);
  });

  it("survivor: an entry that used a mulligan is still alive and still needs a pick", async () => {
    const season = nextSeason++;
    const p = await pool("survivor", season, { mulligans_allowed: 1 });
    const me = await user("Me");
    const mine = await createEntry(p.id, me.id);
    await db.update(entries).set({ mulligansUsed: 1 }).where(eq(entries.id, mine.id));
    await game(season, 2, "KC", "BUF", future(24));
    const e = (await summary(me)).entries[0]!;
    expect(e).toMatchObject({ state: "needs_picks", status: "alive" });
    expect(JSON.stringify(e)).not.toMatch(/mulligan/i);
  });

  it("survivor: season over when every game is decided, with the champion's name", async () => {
    const season = nextSeason++;
    const p = await pool("survivor", season);
    const me = await user("Champion Me");
    const mine = await createEntry(p.id, me.id);
    const lost = await user("Loser");
    const lostEntry = await createEntry(p.id, lost.id);
    await db.update(entries).set({ status: "eliminated", eliminatedWeek: 1 }).where(eq(entries.id, lostEntry.id));
    const g = await game(season, 1, "KC", "BUF", future(-100));
    await db.update(games).set({ result: "home_win" }).where(eq(games.id, g.id));
    const e = (await summary(me)).entries[0]!;
    expect(e).toMatchObject({ entryId: mine.id, state: "season_over", champion: "Champion Me" });
  });

  it("an entry in a season with no games has the no_games state", async () => {
    const season = nextSeason++;
    const p = await pool("survivor", season);
    const me = await user("Me");
    await createEntry(p.id, me.id);
    expect((await summary(me)).entries[0]!.state).toBe("no_games");
  });

  it("the next week opens with its own lock time once a week is fully decided", async () => {
    const season = nextSeason++;
    const p = await pool("survivor", season);
    const me = await user("Me");
    await createEntry(p.id, me.id);
    const done = await game(season, 1, "KC", "BUF", future(-200));
    await db.update(games).set({ result: "away_win" }).where(eq(games.id, done.id));
    const next = future(30);
    await game(season, 2, "DAL", "PHI", next);
    const e = (await summary(me)).entries[0]!;
    expect(e).toMatchObject({ state: "needs_picks", weekNumber: 2 });
    expect(e.lockTime).toBe(next.toISOString());
  });

  it("pick 'em: points, shared ranks, progress and correct picks this week", async () => {
    const season = nextSeason++;
    const p = await pool("pick_em", season);
    const players = await Promise.all(["A", "B", "C", "D"].map((n) => user(n)));
    const ents = [];
    for (const u of players) ents.push(await createEntry(p.id, u.id));
    const g1 = await game(season, 1, "KC", "BUF", future(-5));
    const g2 = await game(season, 1, "DAL", "PHI", future(10));
    await game(season, 1, "SEA", "SF", future(11));
    // A and B each have 1 point, C has 0, D has 1 → three tied at the top.
    for (const [i, team] of [[0, "KC"], [1, "KC"], [3, "KC"]] as const) {
      const pick = await createPick(ents[i]!.id, 1, team);
      await db.update(picks).set({ result: "win" }).where(eq(picks.id, pick.id));
    }
    await createPick(ents[0]!.id, 1, "DAL");
    await db.update(games).set({ result: "home_win" }).where(eq(games.id, g1.id));
    void g2;

    const a = (await summary(players[0]!)).entries[0]!;
    expect(a).toMatchObject({
      state: "locked",
      points: 1,
      rank: 1,
      tied: true,
      playersTotal: 4,
      picksMade: 2,
      gamesTotal: 3,
      correctThisWeek: 1,
    });
    const c = (await summary(players[2]!)).entries[0]!;
    expect(c).toMatchObject({ points: 0, rank: 4, tied: false });
  });

  it("returns only my own entries and nobody's picks or email", async () => {
    const season = nextSeason++;
    const p = await pool("survivor", season);
    const me = await user("Me");
    const rival = await user("Rival");
    await createEntry(p.id, me.id);
    const rivalEntry = await createEntry(p.id, rival.id);
    await game(season, 1, "KC", "BUF", future(24));
    await createPick(rivalEntry.id, 1, "BUF");
    const s = await summary(me);
    const text = JSON.stringify(s);
    expect(s.entries).toHaveLength(1);
    expect(text).not.toContain(rival.email);
    expect(text).not.toContain(me.email);
    expect(text).not.toContain("BUF");
  });

  describe("pick sheet", () => {
    it("gives the owner the week's games, picks and the teams used in other weeks", async () => {
      const season = nextSeason++;
      const p = await pool("survivor", season);
      const me = await user("Me");
      const mine = await createEntry(p.id, me.id);
      const done = await game(season, 1, "DAL", "PHI", future(-200));
      await db.update(games).set({ result: "home_win" }).where(eq(games.id, done.id));
      await createPick(mine.id, 1, "DAL");
      await game(season, 2, "KC", "BUF", future(24));
      await game(season, 2, "SEA", "SF", future(26));

      const res = await sheet(me, mine.id);
      expect(res.statusCode).toBe(200);
      const body = res.json() as PickSheet;
      expect(body).toMatchObject({ state: "needs_picks", weekNumber: 2, limit: 1, poolType: "survivor" });
      expect(body.games.map((g) => g.homeTeam)).toEqual(["KC", "SEA"]);
      expect(body.usedTeams).toEqual({ DAL: 1 });
      // A pick from an earlier week is locked; the whole-week pool keeps the whole-week rule.
      expect(body.lockRule).toBe("week");
      expect(body.picks).toEqual([{ weekNumber: 1, teamCode: "DAL", result: "pending", locked: true }]);
      expect(body.games.every((g) => g.locked === false)).toBe(true);
    });

    it("refuses another player and an admin, with no picks in the answer", async () => {
      const season = nextSeason++;
      const p = await pool("survivor", season);
      const me = await user("Me");
      const rival = await user("Rival");
      const admin = await user("Admin", true);
      const mine = await createEntry(p.id, me.id);
      await game(season, 1, "KC", "BUF", future(24));
      await createPick(mine.id, 1, "KC");

      for (const who of [rival, admin]) {
        const res = await sheet(who, mine.id);
        expect(res.statusCode).toBe(403);
        expect(res.body).not.toContain("KC");
      }
      expect((await sheet(null, mine.id)).statusCode).toBe(401);
      expect((await sheet(me, crypto.randomUUID())).statusCode).toBe(404);
    });

    it("an eliminated entry gets its history and no games", async () => {
      const season = nextSeason++;
      const p = await pool("survivor", season);
      const me = await user("Me");
      const mine = await createEntry(p.id, me.id);
      await createPick(mine.id, 1, "MIA");
      await db.update(entries).set({ status: "eliminated", eliminatedWeek: 1 }).where(eq(entries.id, mine.id));
      await game(season, 2, "KC", "BUF", future(24));
      const body = (await sheet(me, mine.id)).json() as PickSheet;
      expect(body).toMatchObject({ state: "eliminated", eliminatedWeek: 1, games: [], weekNumber: null });
      expect(body.picks).toHaveLength(1);
    });

    it("a double-pick week takes two", async () => {
      const season = nextSeason++;
      const p = await pool("survivor", season, { double_pick_weeks: [1] });
      const me = await user("Me");
      const mine = await createEntry(p.id, me.id);
      await game(season, 1, "KC", "BUF", future(24));
      expect(((await sheet(me, mine.id)).json() as PickSheet).limit).toBe(2);
    });
  });

  describe("a pick must be for a team playing that week", () => {
    it("refuses a team with no game that week and saves nothing; accepts a team that plays", async () => {
      const season = nextSeason++;
      const p = await pool("survivor", season);
      const me = await user("Me");
      const mine = await createEntry(p.id, me.id);
      await game(season, 1, "KC", "BUF", future(24));
      actAs(as(me));

      const bye = await app.inject({
        method: "POST",
        url: `/entries/${mine.id}/picks`,
        payload: { week_number: 1, team_code: "MIA" },
      });
      expect(bye.statusCode).toBe(400);
      expect(bye.json().error).toContain("doesn't play in week 1");
      expect(await db.query.picks.findMany({ where: eq(picks.entryId, mine.id) })).toHaveLength(0);

      const ok = await app.inject({
        method: "POST",
        url: `/entries/${mine.id}/picks`,
        payload: { week_number: 1, team_code: "BUF" },
      });
      expect(ok.statusCode).toBe(201);
    });
  });
});
