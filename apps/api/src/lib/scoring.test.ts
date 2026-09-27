import { defaultSurvivorRulesConfig } from "@bbb/shared";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../db/client.js";
import { entries, games, wipeoutEvents } from "../db/schema.js";
import { cleanupFixtures, createEntry, createGame, createPick, createPool } from "../test/fixtures.js";
import { scoreGame } from "./scoring.js";

describe("scoreGame (survivor)", () => {
  const poolIds: string[] = [];
  const gameIds: string[] = [];

  afterEach(async () => {
    await cleanupFixtures(poolIds.splice(0), gameIds.splice(0));
  });

  it("eliminates an entry whose pick lost, leaves a winning pick's entry alive", async () => {
    const pool = await createPool("survivor", defaultSurvivorRulesConfig);
    poolIds.push(pool.id);

    const winner = await createEntry(pool.id);
    const loser = await createEntry(pool.id);
    const game = await createGame({
      seasonYear: pool.seasonYear,
      weekNumber: 1,
      homeTeam: "AAA",
      awayTeam: "BBB",
      kickoffTime: new Date(),
    });
    gameIds.push(game.id);

    await createPick(winner.id, 1, "AAA");
    await createPick(loser.id, 1, "BBB");

    await db.update(games).set({ result: "home_win" }).where(eq(games.id, game.id));
    await scoreGame(game.id);

    const [winnerRow] = await db.select().from(entries).where(eq(entries.id, winner.id));
    const [loserRow] = await db.select().from(entries).where(eq(entries.id, loser.id));

    expect(winnerRow?.status).toBe("alive");
    expect(loserRow?.status).toBe("eliminated");
    expect(loserRow?.eliminatedWeek).toBe(1);
  });

  it("consumes a mulligan instead of eliminating, when one is available", async () => {
    const pool = await createPool("survivor", { ...defaultSurvivorRulesConfig, mulligans_allowed: 1 });
    poolIds.push(pool.id);

    const entry = await createEntry(pool.id);
    const game = await createGame({
      seasonYear: pool.seasonYear,
      weekNumber: 1,
      homeTeam: "AAA",
      awayTeam: "BBB",
      kickoffTime: new Date(),
    });
    gameIds.push(game.id);

    await createPick(entry.id, 1, "BBB");

    await db.update(games).set({ result: "home_win" }).where(eq(games.id, game.id));
    await scoreGame(game.id);

    const [entryRow] = await db.select().from(entries).where(eq(entries.id, entry.id));
    expect(entryRow?.status).toBe("alive");
    expect(entryRow?.mulligansUsed).toBe(1);
  });

  it("eliminates a double-pick-week entry as soon as either pick loses, without waiting on its other game", async () => {
    const pool = await createPool("survivor", { ...defaultSurvivorRulesConfig, double_pick_weeks: [1] });
    poolIds.push(pool.id);

    const entry = await createEntry(pool.id);
    // A second alive entry with no stake in this game — without it, eliminating
    // `entry` would wipe out the entire pool and get held back as a
    // wipeoutEvents row instead of an actual elimination (see the wipeout
    // test below), which isn't what this test is checking.
    await createEntry(pool.id);
    // The pick that will lose, in a game we score now.
    const losingGame = await createGame({
      seasonYear: pool.seasonYear,
      weekNumber: 1,
      homeTeam: "AAA",
      awayTeam: "BBB",
      kickoffTime: new Date(),
    });
    gameIds.push(losingGame.id);
    // The entry's other pick, in a game that stays pending throughout this test.
    const pendingGame = await createGame({
      seasonYear: pool.seasonYear,
      weekNumber: 1,
      homeTeam: "CCC",
      awayTeam: "DDD",
      kickoffTime: new Date(),
    });
    gameIds.push(pendingGame.id);

    await createPick(entry.id, 1, "BBB"); // loses
    await createPick(entry.id, 1, "CCC"); // still pending — would have won, doesn't matter

    await db.update(games).set({ result: "home_win" }).where(eq(games.id, losingGame.id));
    await scoreGame(losingGame.id);

    const [entryRow] = await db.select().from(entries).where(eq(entries.id, entry.id));
    expect(entryRow?.status).toBe("eliminated");
    expect(entryRow?.eliminatedWeek).toBe(1);
  });

  it("holds back a result that would eliminate every alive entry, as a pending wipeout instead", async () => {
    const pool = await createPool("survivor", defaultSurvivorRulesConfig);
    poolIds.push(pool.id);

    const onlyEntry = await createEntry(pool.id);
    const game = await createGame({
      seasonYear: pool.seasonYear,
      weekNumber: 1,
      homeTeam: "AAA",
      awayTeam: "BBB",
      kickoffTime: new Date(),
    });
    gameIds.push(game.id);

    await createPick(onlyEntry.id, 1, "BBB");

    await db.update(games).set({ result: "home_win" }).where(eq(games.id, game.id));
    await scoreGame(game.id);

    const [entryRow] = await db.select().from(entries).where(eq(entries.id, onlyEntry.id));
    expect(entryRow?.status).toBe("alive");

    const [wipeout] = await db.select().from(wipeoutEvents).where(eq(wipeoutEvents.poolId, pool.id));
    expect(wipeout).toBeDefined();
    expect(wipeout?.resolvedAt).toBeNull();
    expect(wipeout?.candidateEntryIds).toEqual([onlyEntry.id]);
  });
});
