import { expect, test } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

// Sign in by magic link. When password sign-in arrives (slice 4) this file grows with it.

test("the public page asks for an email and sending a link says to check email", async ({ page }) => {
  const db = new TestDb();
  await db.connect();
  try {
    await page.goto("/");
    const email = db.email("link");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByRole("button", { name: "Send magic link" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  } finally {
    await db.close();
  }
});

test("opening the emailed link signs the player in, and Sign out returns to the sign-in page", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const page = await signIn(browser, db, db.email("signin"));
    await expect(page.locator('nav[aria-label="Main"]')).toBeVisible();
    await page.goto("/account");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("button", { name: "Send magic link" })).toBeVisible();
    await page.context().close();
  } finally {
    await db.close();
  }
});
