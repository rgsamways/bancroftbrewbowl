import { expect, test, type Page } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

// Notices: an admin posts one, players see it at the top of every page and can close it on their
// own device, a new notice shows again, and removing one makes it vanish. Rows are named "E2E ...".

const noSideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function clean(db: TestDb) {
  await db.query(`delete from promotions where kind = 'notice' and title like 'E2E %'`);
}

test("an admin posts a notice, a player sees and closes it, a new one shows again, removing it clears it", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    await clean(db);
    const adminEmail = db.email("noticeadmin");
    const admin = await signIn(browser, db, adminEmail);
    await db.setUser(adminEmail, "Nora Notice", true);
    const playerEmail = db.email("noticeplayer");
    const player = await signIn(browser, db, playerEmail);
    await db.setUser(playerEmail, "Pete Player");

    // The admin posts from More > Notices.
    await admin.goto("/admin/more");
    await admin.getByRole("link", { name: /^Notices/ }).click();
    await admin.waitForURL("**/admin/notices");
    await expect(admin.getByText("No notices are showing.")).toBeVisible();
    expect(await noSideways(admin)).toBe(true);
    await admin.getByLabel("Title").fill("E2E Live music Saturday");
    await admin.getByLabel("Message").fill("Doors at 7. Kitchen open late.");
    await admin.getByRole("button", { name: "Post notice" }).click();
    await expect(admin.getByText("Posted. Players see it the next time they open a page.")).toBeVisible();
    await expect(admin.getByTestId("admin-notice")).toContainText("E2E Live music Saturday");
    await expect(admin.getByTestId("notice")).toHaveCount(0); // no banner on admin pages

    // The player sees it at the top of Home and Standings.
    await player.goto("/");
    const banner = player.getByTestId("notice").filter({ hasText: "E2E Live music Saturday" });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Doors at 7. Kitchen open late.");
    expect(await noSideways(player)).toBe(true);
    const top = await banner.boundingBox();
    const main = await player.locator("main").boundingBox();
    expect(top!.y).toBeLessThan(main!.y + 140); // near the top of the page
    await player.goto("/help");
    await expect(player.getByTestId("notice").filter({ hasText: "E2E Live music Saturday" })).toBeVisible();

    // Closing it keeps it closed after a reload and on other pages.
    await player.getByRole("button", { name: "Close notice: E2E Live music Saturday" }).click();
    await expect(player.getByTestId("notice")).toHaveCount(0);
    await player.reload();
    await expect(player.getByTestId("notice").filter({ hasText: "E2E Live music Saturday" })).toHaveCount(0);
    await player.goto("/");
    await expect(player.getByTestId("notice").filter({ hasText: "E2E Live music Saturday" })).toHaveCount(0);

    // A newly posted notice shows even though the first one is closed.
    await admin.getByLabel("Title").fill("E2E Menu change");
    await admin.getByLabel("Message").fill("New fall menu starts Monday.");
    await admin.getByRole("button", { name: "Post notice" }).click();
    await expect(admin.getByTestId("admin-notice")).toHaveCount(2);
    await player.reload();
    await expect(player.getByTestId("notice")).toHaveCount(1);
    await expect(player.getByTestId("notice")).toContainText("E2E Menu change");

    // Removing a notice clears it for everyone.
    await admin.getByRole("button", { name: "Remove E2E Menu change" }).click();
    await admin.getByRole("button", { name: "Yes, remove it" }).click();
    await expect(admin.getByTestId("admin-notice")).toHaveCount(1);
    await player.reload();
    await expect(player.getByTestId("notice")).toHaveCount(0);

    // The closed id of a removed notice is forgotten, so storage does not grow.
    const stored = await player.evaluate(() => window.localStorage.getItem("bbb.closedNotices"));
    expect(JSON.parse(stored ?? "[]")).toHaveLength(1);

    await admin.context().close();
    await player.context().close();
  } finally {
    await clean(db);
    await db.close();
  }
});

test("a player cannot open the admin notices screen", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const email = db.email("noticeblocked");
    const page = await signIn(browser, db, email);
    await db.setUser(email, "Pat Plain");
    await page.goto("/admin/notices");
    await expect(page.getByRole("heading", { name: "Notices" })).toHaveCount(0);
    await page.context().close();
  } finally {
    await db.close();
  }
});
