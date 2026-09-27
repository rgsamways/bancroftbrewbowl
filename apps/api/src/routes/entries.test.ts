import { defaultPickEmRulesConfig } from "@bbb/shared";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "../db/client.js";
import { picks } from "../db/schema.js";
import { cleanupFixtures, createEntry, createPool } from "../test/fixtures.js";
import { computePickEmPoints } from "./entries.js";

describe("computePickEmPoints", () => {
  const poolIds: string[] = [];

  afterEach(async () => {
    await cleanupFixtures(poolIds.splice(0), []);
  });

  it("scores a correct pick as 1 point and an incorrect pick as 0", async () => {
    const pool = await createPool("pick_em", defaultPickEmRulesConfig);
    poolIds.push(pool.id);

    const winner = await createEntry(pool.id);
    const loser = await createEntry(pool.id);
    await db.insert(picks).values([
      { entryId: winner.id, weekNumber: 1, teamCode: "AAA", result: "win" },
      { entryId: loser.id, weekNumber: 1, teamCode: "BBB", result: "loss" },
    ]);

    const points = await computePickEmPoints([winner.id, loser.id], defaultPickEmRulesConfig.tie_handling);
    expect(points.get(winner.id)).toBe(1);
    expect(points.get(loser.id)).toBe(0);
  });

  it("resolves a tied pick per tie_handling: 0 under 'void', 1 under 'everyone_correct'", async () => {
    const pool = await createPool("pick_em", defaultPickEmRulesConfig);
    poolIds.push(pool.id);

    const entry = await createEntry(pool.id);
    await db.insert(picks).values({ entryId: entry.id, weekNumber: 1, teamCode: "AAA", result: "tie" });

    const voided = await computePickEmPoints([entry.id], "void");
    const everyoneCorrect = await computePickEmPoints([entry.id], "everyone_correct");

    expect(voided.get(entry.id)).toBe(0);
    expect(everyoneCorrect.get(entry.id)).toBe(1);
  });
});
