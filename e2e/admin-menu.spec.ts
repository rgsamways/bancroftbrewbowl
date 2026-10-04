import { expect, test, type Page } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";
import { API_URL } from "./env";

// The admin Menu: the new tab, the list with its switch, the add wizard, editing and removing.
// Items are named "E2E ..." and removed at the end.

const noSideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("an admin adds a beer and a dish, switches a beer off, edits it and removes it", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    await db.query(`delete from menu_items where name like 'E2E %'`);
    const email = db.email("menuadmin");
    const page = await signIn(browser, db, email);
    const adminId = await db.setUser(email, "Mia Menu", true);
    const row = async (name: string) => (await db.query(`select * from menu_items where name = $1`, [name])).rows[0];

    // The admin bar has a Menu tab, in the right place.
    await page.goto("/admin");
    const labels = await page.$$eval('nav[aria-label="Admin"] a', (as) => as.map((a) => a.textContent!.trim()));
    expect(labels).toEqual(["Next step", "Results", "Menu", "Pools", "More"]);
    await page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Menu" }).click();
    await page.waitForURL("**/admin/menu");
    await expect(page.locator('nav[aria-label="Admin"] a[aria-current="page"]')).toHaveText("Menu");
    expect(await noSideways(page)).toBe(true);

    // Add a beer, one question at a time.
    await page.getByRole("link", { name: "Add a drink" }).click();
    await expect(page.locator('nav[aria-label="Admin"]')).toHaveCount(0); // a task screen has no bar
    await expect(page.getByText("Step 1 of 4")).toBeVisible();
    await page.getByRole("button", { name: /^A beer/ }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click(); // no name yet: stays and says so
    await expect(page.getByText("Give it a name.")).toBeVisible();
    await page.getByLabel("Name").fill("E2E Hawkwatch IPA");
    await page.getByLabel("Style (optional)").fill("IPA");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Strength").fill("6.2%");
    await page.getByRole("button", { name: "New", exact: true }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Players will see it in the Menu tab straight away.")).toBeVisible();
    expect(await noSideways(page)).toBe(true);
    await page.getByRole("button", { name: "Add to the menu" }).click();
    await expect(page.getByRole("heading", { name: "Added to the menu" })).toBeVisible();
    expect(await row("E2E Hawkwatch IPA")).toMatchObject({ kind: "beer", section: "On tap", style: "IPA", abv: "6.2%", labels: ["new"], price_cents: null, available: true });

    // Add another: a dish with an add-on and a price.
    await page.getByRole("button", { name: "Add another" }).click();
    await page.getByRole("button", { name: /^A dish/ }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Name").fill("E2E Nachos");
    await page.getByLabel("Goes under").fill("E2E Plates");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Price").fill("18");
    await page.getByLabel(/Add-ons or choices/).fill("Add brisket, 9");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Add to the menu" }).click();
    await expect(page.getByRole("heading", { name: "Added to the menu" })).toBeVisible();
    expect(await row("E2E Nachos")).toMatchObject({ kind: "dish", section: "E2E Plates", price_cents: 1800, options: [{ name: "Add brisket", priceCents: 900 }] });
    await page.getByRole("link", { name: "Back to the menu" }).click();
    await expect(page.locator("li", { hasText: "E2E Nachos" })).toContainText("$18");

    // Switch the beer off: the list and the database agree, and so does the public menu.
    await page.getByRole("button", { name: "Drinks" }).click();
    await page.getByRole("switch", { name: "E2E Hawkwatch IPA on tap" }).click();
    await expect(page.locator("li", { hasText: "E2E Hawkwatch IPA" })).toContainText("Out");
    expect((await row("E2E Hawkwatch IPA")).available).toBe(false);
    const publicMenu = await (await fetch(`${API_URL}/public/menu`)).json();
    const hawk = publicMenu.drinks[0].items.find((i: { name: string }) => i.name === "E2E Hawkwatch IPA");
    expect(hawk.available).toBe(false);

    // Edit it.
    await page.locator("li", { hasText: "E2E Hawkwatch IPA" }).getByRole("link").click();
    await expect(page.getByRole("heading", { name: "E2E Hawkwatch IPA" })).toBeVisible();
    await page.getByLabel("Strength").fill("6.5%");
    await page.getByLabel("Price").fill("7.50");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved. Players can see the change now.")).toBeVisible();
    expect(await row("E2E Hawkwatch IPA")).toMatchObject({ abv: "6.5%", price_cents: 750 });
    expect(await noSideways(page)).toBe(true);

    // Remove it: it asks first.
    await page.getByRole("button", { name: "Remove E2E Hawkwatch IPA" }).click();
    await page.getByRole("button", { name: "Keep it" }).click();
    expect(await row("E2E Hawkwatch IPA")).toBeTruthy();
    await page.getByRole("button", { name: "Remove E2E Hawkwatch IPA" }).click();
    await page.getByRole("button", { name: "Yes, remove it" }).click();
    await page.waitForURL("**/admin/menu");
    expect(await row("E2E Hawkwatch IPA")).toBeUndefined();

    // Every change is in Activity.
    const kinds = (await db.query(`select kind from admin_activity where actor_id = $1 and kind like 'menu_item_%'`, [adminId])).rows.map((r) => r.kind as string);
    expect(kinds.sort()).toEqual(["menu_item_added", "menu_item_added", "menu_item_availability_changed", "menu_item_changed", "menu_item_removed"]);
    await page.context().close();
  } finally {
    await db.query(`delete from menu_items where name like 'E2E %'`);
    await db.close();
  }
});
