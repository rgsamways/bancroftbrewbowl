import { expect, test } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

const PASSWORD = "correct horse battery";
const NEW_PASSWORD = "a brand new password";

test("sign-in page opens on the email link tab and offers a password tab", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "Email link" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByPlaceholder("Your password")).toHaveCount(0);
  await expect(page.getByText("You must be 19 or older to play.")).toBeVisible();
  await expect(page.getByText("Please drink responsibly.")).toBeVisible();

  await page.getByRole("tab", { name: "Password" }).click();
  await expect(page.getByPlaceholder("Your password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Email me a sign-in link instead" })).toBeVisible();
});

test("set a password, sign out, sign in with it, then change it", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const email = db.email("pw");
    const page = await signIn(browser, db, email);

    // Set a first password from the Me page.
    await page.goto("/account");
    await expect(page.getByText("Not set.")).toBeVisible();
    await page.getByRole("link", { name: "Set a password" }).click();
    await page.getByLabel("New password").fill("short");
    await page.getByLabel("Type it again").fill("short");
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.getByText("Your new password needs at least 10 characters.")).toBeVisible();

    await page.getByLabel("New password").fill(PASSWORD);
    await page.getByLabel("Type it again").fill("something different");
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.getByText("The two passwords don't match.")).toBeVisible();
    await expect(page.getByLabel("New password")).toHaveValue(PASSWORD); // typed text is kept

    await page.getByLabel("Type it again").fill(PASSWORD);
    await page.getByRole("button", { name: "Save password" }).click();
    await expect(page.getByRole("heading", { name: "Password saved" })).toBeVisible();
    await page.getByRole("link", { name: "Back to Me" }).click();
    await expect(page.getByText("A password is set.")).toBeVisible();

    // Sign out, then sign in with the wrong password and the right one.
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("tab", { name: "Password" }).click();
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("Your password").fill("not the password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByText("That email and password don't match. Check them and try again, or have a sign-in link emailed to you.")
    ).toBeVisible();
    await expect(page.getByPlaceholder("you@example.com")).toHaveValue(email);

    await page.getByPlaceholder("Your password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator('nav[aria-label="Main"]')).toBeVisible();

    // Change it: wrong current first, then the right one.
    await page.goto("/account/password");
    await expect(page.getByRole("heading", { name: "Change your password" })).toBeVisible();
    await page.getByLabel("Current password").fill("not my current one");
    await page.getByLabel("New password").fill(NEW_PASSWORD);
    await page.getByLabel("Type the new one again").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page.getByText("That isn't your current password. Please try again.")).toBeVisible();

    await page.getByLabel("Current password").fill(PASSWORD);
    await page.getByRole("button", { name: "Save new password" }).click();
    await expect(page.getByRole("heading", { name: "Password saved" })).toBeVisible();

    // The new password works after signing out; the old one does not.
    await page.goto("/account");
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByRole("tab", { name: "Password" }).click();
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("Your password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByText("That email and password don't match.")).toBeVisible();
    await page.getByPlaceholder("Your password").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator('nav[aria-label="Main"]')).toBeVisible();
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("Email me a sign-in link instead keeps the typed email and shows Check your email", async ({ page }) => {
  const db = new TestDb();
  await db.connect();
  try {
    await page.goto("/");
    await page.getByRole("tab", { name: "Password" }).click();
    const email = db.email("fallback");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByRole("button", { name: "Email me a sign-in link instead" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  } finally {
    await db.close();
  }
});
