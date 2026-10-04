import { expect, test } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

const SEASON = 2990;

test("helpers: data is created and fully removed, and sign-in reaches the app", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  const before = await db.footprint();
  try {
    const email = db.email("helper");
    const page = await signIn(browser, db, email);
    await expect(page.locator("header")).toBeVisible();
    const userId = await db.setUser(email, "Helper Person");
    const poolId = await db.createPool("Helper Pool", SEASON);
    await db.createGame(SEASON, 1, "KC", "BUF");
    const entryId = await db.createEntry(poolId, userId);
    await db.addPick(entryId, 1, "KC");
    const during = await db.footprint();
    expect(during.users).toBe(before.users + 1);
    expect(during.pools).toBe(before.pools + 1);
    expect(during.picks).toBe(before.picks + 1);
    await page.context().close();
  } finally {
    await db.close();
  }
  const check = new TestDb();
  await check.connect();
  expect(await check.footprint()).toEqual(before);
  await check.close();
});
