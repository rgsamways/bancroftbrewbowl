import { expect, test } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";
import { apiCall } from "./helpers/api";

// A new player joins a pool, finds the pick screen from the Pick tab, picks a team,
// and the pick is saved on the server.

const SEASON = 2993;

test("join a pool, reach the pick screen from the Pick tab, pick a team", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const email = db.email("joiner");
    const page = await signIn(browser, db, email);
    await db.setUser(email, "Joan Joiner");
    const poolId = await db.createPool("Joinable Pool", SEASON);
    const poolRow = (await db.query(`select name from pools where id = $1`, [poolId])).rows[0].name as string;
    await db.createGame(SEASON, 1, "KC", "BUF");

    // A player in no pool yet gets the first-run welcome, with the pool ready to join.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Welcome, Joan Joiner" })).toBeVisible();
    await expect(page.getByText("How it works")).toBeVisible();
    await expect(page.getByText("Join a pool", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: `Join ${poolRow}` }).click();

    // Joining replaces the welcome with the normal Home.
    await expect(page.getByText("Your pools")).toBeVisible();
    await expect(page.getByText("How it works")).toHaveCount(0);

    await page.click('nav[aria-label="Main"] a:has-text("Pick")');
    await page.waitForURL(new RegExp(`/pool/${poolId}/entry/[^/]+/pick$`));
    await page.locator('button:text-is("KC")').click();
    await expect(page.getByText("Current pick")).toBeVisible();

    const entryId = page.url().match(/entry\/([^/]+)\/pick/)![1];
    const saved = await apiCall<{ weekNumber: number; teamCode: string }[]>(page, "GET", `/entries/${entryId}/picks`);
    expect(saved.status).toBe(200);
    expect(saved.json!.some((p) => p.weekNumber === 1 && p.teamCode === "KC")).toBe(true);
    await page.context().close();
  } finally {
    await db.close();
  }
});
