import { defaultSurvivorRulesConfig } from "@bbb/shared";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { cleanupFixtures, createPool, createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";

vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));

type User = Awaited<ReturnType<typeof createUser>>;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin });

describe("pool total", () => {
  let app: FastifyInstance;
  const poolIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(async () => {
    await cleanupFixtures(poolIds.splice(0), [], userIds.splice(0));
  });

  async function setup() {
    const admin = await createUser({ name: "Admin", isAdmin: true });
    const player = await createUser({ name: "Player" });
    userIds.push(admin.id, player.id);
    const pool = await createPool("survivor", defaultSurvivorRulesConfig);
    poolIds.push(pool.id);
    return { admin, player, pool };
  }

  const patch = (poolId: string, payload: unknown) =>
    app.inject({ method: "PATCH", url: `/pools/${poolId}`, payload: payload as object });
  const read = async (poolId: string) =>
    (await app.inject({ method: "GET", url: `/pools/${poolId}` })).json().poolTotalCents as number | null;

  it("a pool never given a total has none", async () => {
    const { pool } = await setup();
    expect(await read(pool.id)).toBeNull();
  });

  it("an admin can set, change and clear the total", async () => {
    const { admin, pool } = await setup();
    actAs(as(admin));

    expect((await patch(pool.id, { pool_total_cents: 32000 })).statusCode).toBe(200);
    expect(await read(pool.id)).toBe(32000);

    expect((await patch(pool.id, { pool_total_cents: 32050 })).statusCode).toBe(200);
    expect(await read(pool.id)).toBe(32050);

    expect((await patch(pool.id, { pool_total_cents: null })).statusCode).toBe(200);
    expect(await read(pool.id)).toBeNull();
  });

  it("a player is refused with 403, and a signed-out request with 401, and nothing changes", async () => {
    const { admin, player, pool } = await setup();
    actAs(as(admin));
    await patch(pool.id, { pool_total_cents: 32000 });

    actAs(as(player));
    expect((await patch(pool.id, { pool_total_cents: 1 })).statusCode).toBe(403);
    actAs(null);
    expect((await patch(pool.id, { pool_total_cents: 1 })).statusCode).toBe(401);

    expect(await read(pool.id)).toBe(32000);
  });

  it("an invalid value is refused and leaves the total unchanged", async () => {
    const { admin, pool } = await setup();
    actAs(as(admin));
    await patch(pool.id, { pool_total_cents: 32000 });

    for (const bad of [-1, 1.5, 100_000_001, "320"]) {
      expect((await patch(pool.id, { pool_total_cents: bad })).statusCode).toBe(400);
    }
    expect(await read(pool.id)).toBe(32000);
  });

  it("can be changed on an active (locked) pool without touching its rules", async () => {
    const { admin, pool } = await setup();
    actAs(as(admin));
    expect(pool.status).toBe("active");

    const res = await patch(pool.id, { pool_total_cents: 4500 });
    expect(res.statusCode).toBe(200);
    expect(res.json().poolTotalCents).toBe(4500);
    expect(res.json().rules).toEqual(pool.rules);
    expect(res.json().status).toBe("active");
  });

  it("changing other settings does not clear the total", async () => {
    const { admin, pool } = await setup();
    actAs(as(admin));
    await patch(pool.id, { pool_total_cents: 32000 });
    await patch(pool.id, { name: "Renamed" });
    expect(await read(pool.id)).toBe(32000);
  });
});
