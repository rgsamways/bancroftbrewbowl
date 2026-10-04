import { expect, test } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";
import { WEB_URL } from "./env";

// The printable table card: a real QR code for the public menu page, and print styles that leave
// only the card.

test("an admin opens the table card from More; the QR encodes the menu address and only the card prints", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const email = db.email("tablecard");
    const page = await signIn(browser, db, email);
    await db.setUser(email, "Tess Table", true);

    await page.goto("/admin/more");
    await page.getByRole("link", { name: /^Table card/ }).click();
    await page.waitForURL("**/admin/table-card");

    const code = page.locator('[data-url]');
    await expect(code).toHaveAttribute("data-url", `${WEB_URL}/menu`);
    await expect(code.locator("svg")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Play Brew Bowl on your phone" })).toBeVisible();
    await expect(page.getByText("Please drink responsibly.")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // Printing: the Print button and the page's own heading are gone; the card stays.
    await expect(page.getByRole("button", { name: "Print" })).toBeVisible();
    await page.emulateMedia({ media: "print" });
    await expect(page.getByRole("button", { name: "Print" })).toBeHidden();
    await expect(page.getByRole("heading", { name: "Table card" })).toBeHidden();
    await expect(page.getByTestId("table-card")).toBeVisible();
    await expect(code.locator("svg")).toBeVisible();
    await page.emulateMedia({ media: "screen" });

    // A player is not sent to the table card.
    const player = await signIn(browser, db, db.email("tablecardplayer"));
    await player.goto("/admin/table-card");
    await player.waitForURL((u) => u.pathname === "/");
    await player.context().close();
    await page.context().close();
  } finally {
    await db.close();
  }
});
