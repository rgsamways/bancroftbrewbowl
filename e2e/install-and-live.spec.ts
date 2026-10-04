import { expect, test, type Browser } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

// Two things on Home: the "Add to home screen" card (shown, dismissed for good, hidden when the
// app is installed) and the "Live this weekend" card (appears and disappears with the event).

let nextSeason = 3970;

async function player(browser: Browser, db: TestDb, label: string) {
  const S = nextSeason++;
  const email = db.email(label);
  const page = await signIn(browser, db, email);
  const userId = await db.setUser(email, "Ina Install");
  const poolId = await db.createPool("Install Survivor", S);
  await db.createGame(S, 1, "KC", "BUF", 2);
  await db.createEntry(poolId, userId);
  return page;
}

test("the install card shows, 'Not now' hides it for good, and an installed app never sees it", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const page = await player(browser, db, "installcard");
    await page.goto("/");
    const card = page.getByRole("region", { name: "Add to home screen" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Add Brew Bowl to your home screen");
    for (const step of ["Tap the Share button in your browser", "Choose Add to Home Screen", "Tap Add"]) await expect(card).toContainText(step);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await card.getByRole("button", { name: "Not now" }).click();
    await expect(card).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: /still alive|Locked in|make your pick/i }).first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Add to home screen" })).toHaveCount(0);

    // Installed (running from the home screen): never shown, even if not dismissed.
    await page.evaluate(() => localStorage.removeItem("bbb:install-dismissed"));
    await page.addInitScript(() => {
      const original = window.matchMedia.bind(window);
      window.matchMedia = (q: string) => (q.includes("standalone") ? ({ ...original(q), matches: true } as MediaQueryList) : original(q));
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: /still alive|Locked in|make your pick/i }).first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Add to home screen" })).toHaveCount(0);
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("Live this weekend appears first under At the brewery when a band is on, and goes when it is removed", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    await db.query(`delete from music_events where title like 'E2E %'`);
    const page = await player(browser, db, "livecard");
    const dow = Number((await db.query(`select extract(dow from (now() at time zone 'America/Toronto')::date)::int as d`)).rows[0].d);
    const sunday = (7 - dow) % 7;
    await db.query(`insert into music_events (title, event_date, start_time, end_time) values ('E2E Dirty Optics', (now() at time zone 'America/Toronto')::date + $1::int, '16:00', '19:00')`, [sunday]);
    // A band weeks away must not show.
    await db.query(`insert into music_events (title, event_date) values ('E2E Far Band', (now() at time zone 'America/Toronto')::date + 40)`);

    await page.goto("/");
    const section = page.getByRole("region", { name: "At the brewery" });
    const live = section.locator("li").first();
    await expect(live).toContainText("Live this weekend");
    await expect(live).toContainText("E2E Dirty Optics");
    await expect(live).toContainText("4 – 7 PM");
    await expect(section.getByText("E2E Far Band")).toHaveCount(0);
    await live.getByRole("link", { name: "See the music" }).click();
    await page.waitForURL("**/menu/music");
    await expect(page.locator("li", { hasText: "E2E Dirty Optics" })).toBeVisible();

    await db.query(`delete from music_events where title like 'E2E %'`);
    await page.goto("/");
    await expect(page.getByRole("region", { name: "At the brewery" })).not.toContainText("Live this weekend");
    await page.context().close();
  } finally {
    await db.query(`delete from music_events where title like 'E2E %'`);
    await db.close();
  }
});
