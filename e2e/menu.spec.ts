import { expect, test, type Page } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

// The menu: open to anyone from the table QR code, and inside the app for a signed-in player.
// Items are named "E2E ..." and removed at the end; nothing else in the menu is touched.

const noSideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function seed(db: TestDb) {
  await db.query(`delete from menu_items where name like 'E2E %'`);
  const insert = `insert into menu_items (kind, section, name, style, abv, description, price_cents, options, labels, available, sort_order)
                  values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)`;
  await db.query(insert, ["beer", "On tap", "E2E Blonde Lady", "Blonde ale", "4.8%", null, null, "[]", ["new"], true, 9001]);
  await db.query(insert, ["beer", "On tap", "E2E Rusty Husky", null, null, null, null, "[]", [], false, 9002]);
  await db.query(insert, ["dish", "E2E Plates", "E2E Nachos", null, null, "Red onion, tomatoes and salsa", 1800, JSON.stringify([{ name: "Brisket", priceCents: 900 }, { name: "Coleslaw", priceCents: null }]), [], true, 9003]);
}

test("a visitor with no account reads the menu from the QR code; the kitchen shows prices and add-ons", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    await seed(db);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto("/menu");

    // Not sent to the sign-in page, no tab bar, an invitation to play.
    await expect(page.getByRole("heading", { name: "Menu" })).toBeVisible();
    await expect(page.getByText("Play Brew Bowl")).toBeVisible();
    await expect(page.getByRole("link", { name: /Sign in/ })).toBeVisible();
    await expect(page.locator('nav[aria-label="Main"]')).toHaveCount(0);

    const blonde = page.locator("li", { hasText: "E2E Blonde Lady" });
    await expect(blonde).toContainText("Blonde ale · 4.8%");
    await expect(blonde).toContainText("New");
    await expect(blonde).not.toContainText("$"); // no price typed, none shown
    await expect(page.locator("li", { hasText: "E2E Rusty Husky" })).toContainText("Out");
    await expect(page.getByText("Please drink responsibly.")).toBeVisible();
    expect(await noSideways(page)).toBe(true);

    await page.getByRole("link", { name: "Kitchen" }).click();
    await page.waitForURL("**/menu/kitchen");
    const nachos = page.locator("li", { hasText: "E2E Nachos" });
    await expect(nachos).toContainText("$18");
    await expect(nachos).toContainText("Add brisket +$9");
    await expect(nachos).toContainText("Coleslaw");
    expect(await noSideways(page)).toBe(true);

    // The invitation leads to the sign-in page.
    await page.getByRole("link", { name: /Sign in/ }).click();
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await context.close();
  } finally {
    await db.query(`delete from menu_items where name like 'E2E %'`);
    await db.close();
  }
});

test("a signed-in player sees the Menu tab marked, and a beer switched off shows as out", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    await seed(db);
    const page = await signIn(browser, db, db.email("menuplayer"));
    await page.goto("/");
    const labels = await page.$$eval('nav[aria-label="Main"] a', (as) => as.map((a) => a.textContent!.trim()));
    expect(labels).toEqual(["Home", "Play", "Menu"]);

    await page.getByRole("link", { name: "Menu" }).click();
    await page.waitForURL("**/menu");
    await expect(page.locator('nav[aria-label="Main"] a[aria-current="page"]')).toHaveText("Menu");
    await expect(page.locator("li", { hasText: "E2E Blonde Lady" })).not.toContainText("Out");
    expect(await noSideways(page)).toBe(true);

    await db.query(`update menu_items set available = false where name = 'E2E Blonde Lady'`);
    await page.reload();
    await expect(page.locator("li", { hasText: "E2E Blonde Lady" })).toContainText("Out");
    await page.context().close();
  } finally {
    await db.query(`delete from menu_items where name like 'E2E %'`);
    await db.close();
  }
});
