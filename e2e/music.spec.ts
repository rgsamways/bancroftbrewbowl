import { expect, test, type Page } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

// The music list: open to anyone from the table QR code, and inside the app for a signed-in
// player. Events are named "E2E ..." and removed at the end.

const noSideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** Dates relative to today in Eastern time, worked out by the database so the test follows the
 * same clock as the server. */
async function seed(db: TestDb) {
  await db.query(`delete from music_events where title like 'E2E %'`);
  const today = `(now() at time zone 'America/Toronto')::date`;
  const dow = Number((await db.query(`select extract(dow from ${today})::int as d`)).rows[0].d);
  const sunday = (7 - dow) % 7; // days until this weekend's Sunday (0 on a Sunday)
  const insert = `insert into music_events (title, event_date, start_time, end_time) values ($1, ${today} + $2::int, $3, $4)`;
  await db.query(insert, ["E2E Weekend Band", sunday, "13:00", "16:00"]);
  await db.query(insert, ["E2E Later Band", 30, null, null]);
  await db.query(insert, ["E2E Past Band", -2, "19:00", null]);
}

test("a visitor reads the music list from the QR code: this weekend, coming up, times, and no past events", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    await seed(db);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto("/menu/music");

    await expect(page.getByText("Live music at the brewery.")).toBeVisible();
    await expect(page.locator('nav[aria-label="Main"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Sign in/ })).toBeVisible();

    await expect(page.getByRole("heading", { name: "This weekend" })).toBeVisible();
    await expect(page.locator("li", { hasText: "E2E Weekend Band" })).toContainText("1 – 4 PM");
    await expect(page.getByRole("heading", { name: "Coming up" })).toBeVisible();
    await expect(page.locator("li", { hasText: "E2E Later Band" })).toContainText("Time to be confirmed");
    await expect(page.getByText("E2E Past Band")).toHaveCount(0);
    expect(await noSideways(page)).toBe(true);

    // The three tabs lead to each other.
    await page.getByRole("link", { name: "Drinks" }).click();
    await page.waitForURL((u) => u.pathname === "/menu");
    await page.getByRole("link", { name: "Music" }).click();
    await page.waitForURL("**/menu/music");
    await context.close();
  } finally {
    await db.query(`delete from music_events where title like 'E2E %'`);
    await db.close();
  }
});

test("a signed-in player sees Music inside the app with the Menu tab marked", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    await seed(db);
    const page = await signIn(browser, db, db.email("musicplayer"));
    await page.goto("/menu/music");
    await expect(page.locator("li", { hasText: "E2E Weekend Band" })).toBeVisible();
    await expect(page.locator('nav[aria-label="Main"] a[aria-current="page"]')).toHaveText("Menu");
    expect(await noSideways(page)).toBe(true);
    await page.context().close();
  } finally {
    await db.query(`delete from music_events where title like 'E2E %'`);
    await db.close();
  }
});

test("with nothing scheduled the page says so", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    await db.query(`delete from music_events where title like 'E2E %'`);
    const existing = Number((await db.query(`select count(*) as n from music_events where event_date >= (now() at time zone 'America/Toronto')::date`)).rows[0].n);
    test.skip(existing > 0, "other upcoming events exist in this database");
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto("/menu/music");
    await expect(page.getByText("Nothing is scheduled yet. Check back soon.")).toBeVisible();
    await context.close();
  } finally {
    await db.close();
  }
});
