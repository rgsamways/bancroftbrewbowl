import { expect, test } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

// Standings: summary card, Show all, Find a player, shared pick 'em ranks, pool tabs, final standings.

test("survivor: short lists, Show all, and Find a player that searches everyone", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2975;
    const email = db.email("sv");
    const page = await signIn(browser, db, email);
    const me = await db.setUser(email, "Robin Samways");
    const poolId = await db.createPool("Big Survivor", SEASON);
    const gameId = await db.createGame(SEASON, 1, "KC", "BUF", 2);
    void gameId;
    await db.createEntry(poolId, me);
    const aliveNames = ["Aaron P", "Beth C", "Big Mike", "Chris L", "Dana W", "Dave M", "Elena R", "Fay G", "Gus H", "Hana J", "Ivan K", "Priya N"];
    for (const n of aliveNames) await db.createEntry(poolId, await db.createPlayer(`a${n}`, n));
    for (let i = 1; i <= 7; i++) {
      const id = await db.createEntry(poolId, await db.createPlayer(`o${i}`, `Out Player ${i}`), "eliminated");
      await db.query(`update entries set eliminated_week = $2 where id = $1`, [id, i % 3 + 1]);
    }

    await page.goto(`/pool/${poolId}`);
    await expect(page.getByRole("heading", { name: "You're still alive" })).toBeVisible();
    await expect(page.getByText("13 of 20 still alive")).toBeVisible();
    await expect(page.getByText("Before week 1 · 7 players out so far")).toBeVisible();

    // Short lists with Show all; the viewer is first and marked.
    await expect(page.getByText("Still alive 13")).toBeVisible();
    const aliveRows = page.locator("section", { hasText: "Still alive 13" }).locator("ul > li");
    await expect(aliveRows).toHaveCount(8);
    await expect(aliveRows.first()).toContainText("Robin Samways");
    await expect(aliveRows.first()).toContainText("You");
    await page.getByRole("button", { name: "Show all 13" }).click();
    await expect(aliveRows).toHaveCount(13);

    const outRows = page.locator("section", { hasText: "Eliminated 7" }).locator("ul > li");
    await expect(outRows).toHaveCount(5);
    await expect(outRows.first()).toContainText("Out in week 3");
    await page.getByRole("button", { name: "Show all 7" }).click();
    await expect(outRows).toHaveCount(7);

    // Find a player searches everyone, not only the rows that were showing.
    await page.reload();
    await expect(page.getByRole("button", { name: "Show all 13" })).toBeVisible();
    await page.getByLabel("Find a player").fill("priya");
    await expect(page.getByText("Priya N")).toBeVisible();
    await expect(page.getByText("Aaron P")).toHaveCount(0);
    await page.getByLabel("Find a player").fill("nobody called this");
    await expect(page.getByText("No players match")).toBeVisible();
    await page.getByLabel("Find a player").fill("");
    await expect(page.getByRole("button", { name: "Show all 13" })).toBeVisible();

    // Phone fit: no sideways scroll, and big enough to tap.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const target of [page.getByLabel("Find a player"), page.getByRole("button", { name: "Show all 13" })]) {
      expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("pick 'em: shared ranks that skip, the summary card and the leaderboard", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2974;
    const email = db.email("pe");
    const page = await signIn(browser, db, email);
    const me = await db.setUser(email, "Robin Samways");
    const poolId = await db.createPool("Board PickEm", SEASON, "pick_em");
    await db.query(`update pools set pool_total_cents = 20500 where id = $1`, [poolId]);
    await db.createGame(SEASON, 1, "KC", "BUF", 2);
    const scores: [string, number][] = [["Dave M", 4], ["Sandra K", 3], ["Big Mike", 2], ["Priya N", 1], ["Tom H", 0]];
    const entries: Record<string, string> = {};
    entries.me = await db.createEntry(poolId, me);
    for (const [n] of scores) entries[n] = await db.createEntry(poolId, await db.createPlayer(`p${n}`, n));
    const giveWins = async (entryId: string, n: number) => {
      for (let w = 1; w <= n; w++) {
        await db.addPick(entryId, w, "KC");
        await db.setPickResult(entryId, w, "KC", "win");
      }
    };
    for (const [n, pts] of scores) await giveWins(entries[n]!, pts);
    await giveWins(entries.me!, 1); // Robin ties Priya on 1 point

    await page.goto(`/pool/${poolId}`);
    await expect(page.getByRole("heading", { name: "T4" })).toBeVisible();
    await expect(page.getByText("tied for 4th of 6 players")).toBeVisible();
    await expect(page.getByText("1 point · 3 behind the leader")).toBeVisible();
    await expect(page.getByText("$205", { exact: true })).toBeVisible();
    await expect(page.getByText("Leaderboard", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Points update as the brewery adds game results.")).toBeVisible();

    const rows = page.locator("section", { hasText: "Leaderboard" }).locator("ul > li");
    await expect(rows).toHaveCount(6);
    const texts = await rows.allTextContents();
    expect(texts[0]).toContain("Dave M");
    expect(texts[0]).toMatch(/^1/);
    // Robin and Priya tie for 4th and Tom is 6th.
    expect(texts[3]).toMatch(/^T4/);
    expect(texts[4]).toMatch(/^T4/);
    expect(texts[3] + texts[4]).toContain("Robin Samways");
    expect(texts[3] + texts[4]).toContain("Priya N");
    expect(texts[5]).toMatch(/^6/);
    expect(texts[5]).toContain("Tom H");
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("a finished season says Final standings", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2973;
    const email = db.email("fin");
    const page = await signIn(browser, db, email);
    const me = await db.setUser(email, "Fin Player");
    const poolId = await db.createPool("Final PickEm", SEASON, "pick_em");
    const g = await db.createGame(SEASON, 1, "KC", "BUF", -10);
    await db.decideGame(g, "home_win");
    await db.createEntry(poolId, me);
    await page.goto(`/pool/${poolId}`);
    await expect(page.getByText("Final standings")).toBeVisible();
    await page.context().close();
  } finally {
    await db.close();
  }
});
