import { expect, test, type Page } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

// The admin From the brewery screens: the hub, the three wizards, and removing a post.
// Rows are named "E2E ..." and removed at the end.

const noSideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
let nextSeason = 3950;

async function clean(db: TestDb) {
  await db.query(`delete from promotions where title like 'E2E %'`);
  await db.query(`delete from menu_items where name like 'E2E %'`);
}

test("an admin features an item, adds a special, writes an announcement, and removes them", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    await clean(db);
    const S = nextSeason++;
    await db.createGame(S, 1, "KC", "BUF", 2); // the current week, so a feature can be "this week"
    await db.query(`insert into menu_items (kind, section, name, style, abv, sort_order) values ('beer', 'On tap', 'E2E Blonde Lady', 'Blonde ale', '4.8%', 9201)`);
    const email = db.email("brewadmin");
    const page = await signIn(browser, db, email);
    const adminId = await db.setUser(email, "Bo Brewery", true);
    const count = async (kind: string) => Number((await db.query(`select count(*) as n from promotions where kind = $1 and title like 'E2E %'`, [kind])).rows[0].n);

    // More leads to From the brewery; the old Promotions address does too.
    await page.goto("/admin/more");
    await expect(page.getByRole("link", { name: /^Promotions/ })).toHaveCount(0);
    await page.getByRole("link", { name: /^From the brewery/ }).click();
    await page.waitForURL("**/admin/brewery");
    await expect(page.getByRole("heading", { name: "From the brewery" })).toBeVisible();
    await expect(page.getByText('Nothing posted. Players see the standard "Watch with us" message.')).toBeVisible();
    expect(await noSideways(page)).toBe(true);
    await page.goto("/admin/promotions");
    await page.waitForURL("**/admin/brewery");

    // Feature a menu item (2 steps).
    await page.getByRole("link", { name: /Feature a drink or dish/ }).click();
    await expect(page.locator('nav[aria-label="Admin"]')).toHaveCount(0);
    await expect(page.getByText("Step 1 of 2")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Pick something from the menu.", { exact: true }).first()).toBeVisible();
    await page.getByLabel("Search the menu").fill("E2E Blonde");
    await page.getByRole("button", { name: /E2E Blonde Lady/ }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Featured: E2E Blonde Lady")).toBeVisible();
    await page.getByRole("button", { name: "Until I change it" }).click();
    await page.getByRole("button", { name: "Feature it" }).click();
    await expect(page.getByRole("heading", { name: "Featured" })).toBeVisible();
    expect(await count("feature")).toBe(1);
    await page.getByRole("link", { name: "Back to From the brewery" }).click();

    // Add a special (3 steps) every Sunday 1 to 4.
    await page.getByRole("link", { name: /Add a special/ }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Give the special a title.")).toBeVisible();
    await page.getByLabel("Title").fill("E2E Sunday football");
    await page.getByLabel("Details (optional)").fill("Wings and nachos");
    await page.getByRole("button", { name: "Game-day special" }).click();
    await expect(page.getByText(/Don't link a special to winning, losing or picks/)).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click(); // no day yet
    await expect(page.getByText("Pick at least one day.")).toBeVisible();
    await page.getByRole("button", { name: "Sun", exact: true }).click();
    await page.getByLabel("From").fill("13:00");
    await page.getByLabel("Until").fill("16:00");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Sundays, 1 – 4 PM")).toBeVisible();
    expect(await noSideways(page)).toBe(true);
    await page.getByRole("button", { name: "Post it" }).click();
    await expect(page.getByRole("heading", { name: "Posted" })).toBeVisible();
    expect(await count("special")).toBe(1);
    await page.getByRole("link", { name: "Back to From the brewery" }).click();

    // Write an announcement for this week (3 steps).
    await page.getByRole("link", { name: /Write an announcement/ }).click();
    await page.getByRole("button", { name: "Watch with us" }).click(); // an idea chip fills the title
    await expect(page.getByLabel("Title")).toHaveValue("Watch with us");
    await page.getByLabel("Title").fill("E2E Watch with us");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Message").fill("Big screen, big wings.");
    await expect(page.getByText("Big screen, big wings.").first()).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(/Week 1, starting now/)).toBeVisible();
    await page.getByRole("button", { name: "Post it" }).click();
    await expect(page.getByRole("heading", { name: "Posted" })).toBeVisible();
    expect(await count("announcement")).toBe(1);
    await page.getByRole("link", { name: "Back to From the brewery" }).click();

    // Showing now lists all three, with Remove that asks first.
    const showing = page.locator("section", { hasText: "Showing now" });
    await expect(showing.locator("li", { hasText: "E2E Blonde Lady" })).toContainText("Until changed");
    await expect(showing.locator("li", { hasText: "E2E Sunday football" })).toContainText("Sundays, 1 – 4 PM");
    await expect(showing.locator("li", { hasText: "E2E Watch with us" })).toContainText("Week 1");
    await showing.getByRole("button", { name: "Remove E2E Sunday football" }).click();
    await showing.getByRole("button", { name: "Keep it" }).click();
    expect(await count("special")).toBe(1);
    await showing.getByRole("button", { name: "Remove E2E Sunday football" }).click();
    await showing.getByRole("button", { name: "Yes, remove it" }).click();
    await expect(showing.getByText("E2E Sunday football")).toHaveCount(0);
    expect(await count("special")).toBe(0);

    // Every post and removal is in Activity.
    const kinds = (await db.query(`select kind from admin_activity where actor_id = $1 and kind like 'brewery_%'`, [adminId])).rows.map((r) => r.kind as string);
    expect(kinds.sort()).toEqual(["brewery_announcement_posted", "brewery_feature_set", "brewery_item_removed", "brewery_special_added"]);
    await page.context().close();
  } finally {
    await clean(db);
    await db.close();
  }
});
