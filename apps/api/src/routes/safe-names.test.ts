import { defaultPickEmRulesConfig, defaultSurvivorRulesConfig } from "@bbb/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { user as userTable } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { cleanupFixtures, createEntry, createGame, createPool, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";

vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));

type User = Awaited<ReturnType<typeof createUser>>;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin });

// A new account is named with its email address until the player sets a display name. That
// address must never reach another player's screen.
describe("player names never show an email address", () => {
  let app: FastifyInstance;
  const poolIds: string[] = [];
  const gameIds: string[] = [];
  const userIds: string[] = [];
  let nextSeason = 2930;

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(async () => {
    await cleanupFixtures(poolIds.splice(0), gameIds.splice(0), userIds.splice(0));
  });

  const scene = async (type: "survivor" | "pick_em") => {
    const season = nextSeason++;
    const p =
      type === "survivor"
        ? await createPool("survivor", defaultSurvivorRulesConfig, season)
        : await createPool("pick_em", defaultPickEmRulesConfig, season);
    poolIds.push(p.id);
    const g = await createGame({ seasonYear: season, weekNumber: 1, homeTeam: "KC", awayTeam: "BUF", kickoffTime: new Date(Date.now() + 86_400_000) });
    gameIds.push(g.id);
    const viewer = await createUser({ name: "Named Viewer" });
    const unnamed = await createUser({});
    userIds.push(viewer.id, unnamed.id);
    // The account is named with its email, as better-auth does for a new sign-in.
    await db.update(userTable).set({ name: "lark.popowicz@example.com" }).where(eq(userTable.id, unnamed.id));
    await createEntry(p.id, viewer.id);
    await createEntry(p.id, unnamed.id);
    return { pool: p, viewer };
  };

  const get = async (viewer: User, url: string) => {
    actAs(as(viewer));
    const res = await app.inject({ method: "GET", url });
    return { body: res.body, json: res.json() };
  };

  for (const type of ["survivor", "pick_em"] as const) {
    it(`${type}: Standings, the TV and the pool's player list show the part before the @`, async () => {
      const { pool, viewer } = await scene(type);

      const standings = await get(viewer, `/pools/${pool.id}/standings`);
      expect(standings.body).not.toContain("@");
      expect(standings.body).toContain("lark.popowicz");

      const tv = await get(viewer, `/pools/${pool.id}/tv`);
      expect(tv.body).not.toContain("@");
      expect(tv.body).toContain("lark.popowicz");

      const list = await get(viewer, `/pools/${pool.id}/entries`);
      expect((list.json as { displayName: string }[]).map((e) => e.displayName).sort()).toEqual(["Named Viewer", "lark.popowicz"]);
      // The other player's address is not in it at all (only the viewer's own may be).
      const others = (list.json as { displayName: string; email: string }[]).filter((e) => e.displayName !== "Named Viewer");
      expect(others).toHaveLength(1);
      expect(JSON.stringify(others)).not.toContain("@");
    });
  }

  it("a normal name is shown unchanged", async () => {
    const { pool, viewer } = await scene("survivor");
    const standings = await get(viewer, `/pools/${pool.id}/standings`);
    expect(standings.body).toContain("Named Viewer");
  });
});
