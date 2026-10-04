import { expect, test } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";
import { API_URL, WEB_URL } from "./env";

// Sign in by magic link: the sign-in page, check-your-email with resend, and a link that did not work.

test("the public page asks for an email and sending a link says to check email", async ({ page }) => {
  const db = new TestDb();
  await db.connect();
  try {
    await page.goto("/");
    const email = db.email("link");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
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
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("a failed send keeps the typed email and says the link was not sent", async ({ page }) => {
  await page.route("**/api/auth/sign-in/magic-link**", (route) => route.abort());
  await page.goto("/");
  await page.getByPlaceholder("you@example.com").fill("keep.me@example.test");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText("We couldn't send the link.")).toBeVisible();
  await expect(page.getByPlaceholder("you@example.com")).toHaveValue("keep.me@example.test");
});

test("check your email: Resend waits, then sends again; a different email returns to the form", async ({ page }) => {
  const db = new TestDb();
  await db.connect();
  try {
    await page.clock.install();
    let sends = 0;
    await page.route("**/api/auth/sign-in/magic-link**", (route) => {
      sends += 1;
      return route.continue();
    });
    await page.goto("/");
    const email = db.email("resend");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    const resend = page.getByRole("button", { name: /^Resend link/ });
    await expect(resend).toBeDisabled();
    await expect(resend).toContainText("Resend link in");

    await page.clock.fastForward(31_000);
    await expect(resend).toBeEnabled();
    await expect(resend).toHaveText("Resend link");
    await resend.click();
    await expect.poll(() => sends).toBe(2);
    await expect(resend).toBeDisabled(); // the wait starts again

    await page.getByRole("button", { name: "Use a different email" }).click();
    await expect(page.getByPlaceholder("you@example.com")).toHaveValue(email);
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();
  } finally {
    await db.close();
  }
});

test("a link works once; opening it again shows 'That link didn't work' with the email ready", async ({ page }) => {
  const db = new TestDb();
  await db.connect();
  try {
    await page.goto("/");
    const email = db.email("used");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

    const { rows } = await db.query(`select identifier from verification where value like $1 order by created_at desc limit 1`, [`%${email}%`]);
    const verifyUrl = `${API_URL}/api/auth/magic-link/verify?token=${rows[0].identifier}&callbackURL=${encodeURIComponent(WEB_URL)}`;

    await page.goto(verifyUrl);
    await expect(page.locator('nav[aria-label="Main"]')).toBeVisible(); // first use signs in

    await page.goto("/account");
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeVisible();

    await page.goto(verifyUrl); // second use
    await expect(page.getByRole("heading", { name: "That link didn't work" })).toBeVisible();
    await expect(page.locator('nav[aria-label="Main"]')).toHaveCount(0);
    expect(new URL(page.url()).search).toBe(""); // the error marker is cleared from the address

    await page.getByRole("button", { name: "Email me a new link" }).click();
    await expect(page.getByRole("heading", { name: "Sign in to play" })).toBeVisible();
    await expect(page.getByPlaceholder("you@example.com")).toHaveValue(email);
  } finally {
    await db.close();
  }
});
