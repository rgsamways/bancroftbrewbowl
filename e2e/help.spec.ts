import { expect, test, type Page } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

// How to play (from Me), the Admin guide (from More, and refused to players), and the pages
// fitting a phone.

const noSideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("a player opens How to play from Me; the sign-in answer mentions the password option", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const page = await signIn(browser, db, db.email("helpplayer"));
    await page.goto("/account");
    await page.getByRole("link", { name: "How to play" }).click();
    await page.waitForURL("**/help");
    await expect(page.getByRole("heading", { name: "How to play" })).toBeVisible();
    for (const group of ["The two games", "Picking", "Your account"]) await expect(page.getByRole("heading", { name: group })).toBeVisible();

    await page.getByText("How do I sign in?").click();
    await expect(page.getByText(/set a password on the Me page/)).toBeVisible();
    await expect(page.getByText(/no password/i)).toHaveCount(0);
    await page.getByText("Who can play?").click();
    await expect(page.getByText("You must be 19 or older to play.")).toBeVisible();
    expect(await noSideways(page)).toBe(true);

    await page.getByRole("link", { name: "Back to Me" }).click();
    await page.waitForURL("**/account");

    // A player is not sent to the admin guide.
    await page.goto("/admin/guide");
    await page.waitForURL((u) => u.pathname === "/");
    await expect(page.getByRole("heading", { name: "Admin guide" })).toHaveCount(0);
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("an admin opens the Admin guide from More", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const email = db.email("helpadmin");
    const page = await signIn(browser, db, email);
    await db.setUser(email, "Hana Help", true);
    await page.goto("/admin/more");
    await page.getByRole("link", { name: /^Admin guide/ }).click();
    await page.waitForURL("**/admin/guide");
    await expect(page.getByRole("heading", { name: "Admin guide" })).toBeVisible();
    for (const group of ["Every week", "Setting up", "If you are also playing", "If something goes wrong"]) {
      await expect(page.getByRole("heading", { name: group })).toBeVisible();
    }
    await page.getByText("Why does my own entry need someone else?").click();
    await expect(page.getByText(/another admin has to confirm it first/)).toBeVisible();
    await page.getByText("Tell players what's on").click();
    await expect(page.getByText(/Open More, then From the brewery/)).toBeVisible();
    expect(await noSideways(page)).toBe(true);
    await page.context().close();
  } finally {
    await db.close();
  }
});
