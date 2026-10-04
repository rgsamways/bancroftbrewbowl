import { expect, test } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

// The Activity page: an admin's change appears with who, what and when; filters work;
// players cannot reach it.

test("an admin's result shows up in Activity, a player is sent away, and filters narrow the list", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2971;
    const adminEmail = db.email("actadmin");
    const playerEmail = db.email("actplayer");
    const admin = await signIn(browser, db, adminEmail);
    const player = await signIn(browser, db, playerEmail);
    await db.setUser(adminEmail, "Alex Activity", true);
    const playerId = await db.setUser(playerEmail, "Pat Plain");
    const poolId = await db.createPool("Activity Pool", SEASON);
    const gameId = await db.createGame(SEASON, 1, "KC", "BUF", -1);
    await db.createEntry(poolId, playerId);
    void gameId;

    // The admin enters a result on the Schedule page.
    await admin.goto("/admin/results");
    await admin.getByRole("button", { name: "BUF Bills won" }).click();
    await expect(admin.getByText("Done 1")).toBeVisible();

    // Then opens Activity from More.
    await admin.getByRole("link", { name: "More" }).click();
    await admin.getByRole("link", { name: /^Activity/ }).click();
    await admin.waitForURL("**/admin/activity");
    await expect(admin.getByText("Every change that affects the standings or the menu, and who made it.")).toBeVisible();
    const first = admin.locator("main li").first();
    await expect(first).toContainText("Today");
    await expect(first).toContainText("Entered a result");
    await expect(first).toContainText("Alex Activity entered a result: Chiefs vs Bills, Bills won.");
    await expect(admin.getByText("Nothing here can be edited or deleted. Players don't see this page.")).toBeVisible();

    // Filters.
    await admin.getByRole("button", { name: "Menu" }).click();
    await expect(admin.getByText("No menu changes yet.")).toBeVisible();
    await admin.getByRole("button", { name: "Your own entry" }).click();
    await expect(admin.getByText("Nothing has affected your own entry.")).toBeVisible();
    await admin.getByRole("button", { name: "Standings" }).click();
    await expect(admin.locator("main li").first()).toContainText("Entered a result");

    // No sideways scroll, and the filter buttons are big enough to tap.
    expect(await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect((await admin.getByRole("button", { name: "Everything" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);

    // A player has no link to it, and opening the address shows nothing of the record.
    await player.goto("/");
    await expect(player.getByRole("link", { name: "Activity" })).toHaveCount(0);
    await expect(player.getByRole("navigation", { name: "Admin" })).toHaveCount(0);
    await player.goto("/admin/activity");
    await player.waitForURL((url) => !url.pathname.startsWith("/admin"));
    await expect(player.getByText("entered a result")).toHaveCount(0);

    await admin.context().close();
    await player.context().close();
  } finally {
    await db.close();
  }
});
