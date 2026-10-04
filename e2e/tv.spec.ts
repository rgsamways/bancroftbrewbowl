import { expect, test } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

// The TV page: a signed-in, full-screen 16:9 view of a pool. Pick counts appear only after the lock.

const SEASON = 2996;
const TV = { width: 1280, height: 720 };

test("survivor TV: names and count before the lock, most picked only after it, no header or tabs", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const mine = db.email("me");
    const page = await signIn(browser, db, mine);
    const meId = await db.setUser(mine, "Tv Me");
    const a = await db.createPlayer("a", "Alpha Player");
    const b = await db.createPlayer("b", "Bravo Player");
    const c = await db.createPlayer("c", "Gone Player");
    const poolId = await db.createPool("Tv Pool", SEASON);
    const game = await db.createGame(SEASON, 1, "KC", "BUF");
    const meEntry = await db.createEntry(poolId, meId);
    const aEntry = await db.createEntry(poolId, a);
    const bEntry = await db.createEntry(poolId, b);
    const cEntry = await db.createEntry(poolId, c, "eliminated");
    await db.eliminate(cEntry, 1);
    await db.addPick(meEntry, 1, "KC");
    await db.addPick(aEntry, 1, "KC");
    await db.addPick(bEntry, 1, "BUF");

    await page.setViewportSize(TV);
    await page.goto(`/pool/${poolId}/tv`);
    await expect(page.getByTestId("tv-count")).toHaveText("3");
    await expect(page.getByText("of 4 still alive")).toBeVisible();
    await expect(page.getByTestId("tv-status")).toHaveText("Picks open");
    await expect(page.getByTestId("tv-names").getByText("Alpha Player")).toBeVisible();
    await expect(page.getByText("Gone Player")).toHaveCount(0);
    await expect(page.getByText("Shown once picks lock")).toBeVisible();
    await expect(page.getByTestId("tv-most-picked")).toHaveCount(0);
    // No header or tab bar on the TV.
    await expect(page.locator("header")).toHaveCount(0);
    await expect(page.getByRole("navigation")).toHaveCount(0);
    // The QR points at the site.
    await expect(page.getByRole("img", { name: "QR code to play on your phone" })).toHaveAttribute("data-url", /^http/);
    await expect(page.locator('[role="img"] svg')).toBeVisible();
    // The canvas fills the screen with no scrolling.
    const box = await page.getByTestId("tv-canvas").boundingBox();
    expect(Math.round(box!.width)).toBe(TV.width);
    expect(Math.round(box!.height)).toBe(TV.height);

    // The lock passes: counts appear on the next refresh.
    await db.setKickoffIn(game, -60);
    await page.reload();
    await expect(page.getByTestId("tv-status")).toHaveText("Picks locked · games underway");
    const rows = page.getByTestId("tv-most-picked");
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText("Chiefs");
    await expect(rows.first()).toContainText("67%");
    await expect(rows.nth(1)).toContainText("Bills");
    await expect(rows.nth(1)).toContainText("33%");

    await page.context().close();
  } finally {
    await db.close();
  }
});

test("pick 'em TV: a leaderboard instead of names", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const mine = db.email("pe");
    const page = await signIn(browser, db, mine);
    const meId = await db.setUser(mine, "Pe Me");
    const other = await db.createPlayer("o", "Other Player");
    const poolId = await db.createPool("Tv Pick Em", SEASON + 1, "pick_em");
    const game = await db.createGame(SEASON + 1, 1, "KC", "BUF");
    await db.createGame(SEASON + 1, 2, "DET", "NYJ");
    const meEntry = await db.createEntry(poolId, meId);
    const otherEntry = await db.createEntry(poolId, other);
    await db.addPick(meEntry, 1, "KC");
    await db.addPick(otherEntry, 1, "BUF");
    await db.setKickoffIn(game, -3600);
    await db.decideGame(game, "home_win");
    await db.setPickResult(meEntry, 1, "KC", "win");
    await db.setPickResult(otherEntry, 1, "BUF", "loss");

    await page.setViewportSize(TV);
    await page.goto(`/pool/${poolId}/tv`);
    const board = page.getByTestId("tv-leaderboard");
    await expect(board.locator("li")).toHaveCount(2);
    await expect(board.locator("li").first()).toContainText("Pe Me");
    await expect(board.locator("li").first()).toContainText(/1s*pts/);
    await expect(page.getByTestId("tv-names")).toHaveCount(0);

    await page.context().close();
  } finally {
    await db.close();
  }
});

test("a signed-out visitor is asked to sign in", async ({ page }) => {
  await page.goto("/pool/00000000-0000-0000-0000-000000000000/tv");
  await expect(page.getByRole("button", { name: /email me a sign-in link|send/i }).first()).toBeVisible();
});
