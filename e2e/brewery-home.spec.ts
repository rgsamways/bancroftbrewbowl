import { expect, test, type Page } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

// "At the brewery" on Home: the featured item, a special on today, the announcement, and the
// standard message when nothing is posted. Rows are named "E2E ..." and removed at the end.

const noSideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
let nextSeason = 3900;

async function clean(db: TestDb) {
  await db.query(`delete from promotions where title like 'E2E %'`);
  await db.query(`delete from menu_items where name like 'E2E %'`);
}

async function player(browser: import("@playwright/test").Browser, db: TestDb, S: number, label: string) {
  const email = db.email(label);
  const page = await signIn(browser, db, email);
  const userId = await db.setUser(email, "Bea Brewery");
  const poolId = await db.createPool("Brewery Survivor", S);
  await db.createGame(S, 1, "KC", "BUF", 2); // still to be played: week 1 is the current week
  await db.createEntry(poolId, userId);
  return page;
}

test("a player sees the featured item, today's special and the announcement under At the brewery", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    await clean(db);
    const S = nextSeason++;
    const page = await player(browser, db, S, "breweryhome");
    const dow = Number((await db.query(`select extract(dow from (now() at time zone 'America/Toronto')::date)::int as d`)).rows[0].d);
    const other = (dow + 3) % 7;

    const item = (await db.query(`insert into menu_items (kind, section, name, style, abv, price_cents, sort_order) values ('beer', 'On tap', 'E2E Hawkwatch IPA', 'IPA', '6.2%', 750, 9101) returning id`)).rows[0].id as string;
    await db.query(`insert into promotions (kind, title, description, menu_item_id) values ('feature', 'E2E Hawkwatch IPA', '', $1)`, [item]);
    await db.query(`insert into promotions (kind, title, description, days, start_time, end_time, tag) values ('special', 'E2E Football wings', 'Wings and nachos', $1, '13:00', '16:00', 'game_day')`, [[dow]]);
    await db.query(`insert into promotions (kind, title, description, days) values ('special', 'E2E Another day special', '', $1)`, [[other]]);
    await db.query(`insert into promotions (kind, title, description, season_year, week_number) values ('announcement', 'E2E Watch with us', 'Big screen Sunday', $1, 1)`, [S]);

    await page.goto("/");
    const section = page.getByRole("region", { name: "At the brewery" });
    await expect(section).toBeVisible();
    await expect(section.locator("li").nth(0)).toContainText("Featured");
    await expect(section.locator("li").nth(0)).toContainText("E2E Hawkwatch IPA");
    await expect(section.locator("li").nth(0)).toContainText("IPA · 6.2%");
    await expect(section.locator("li").nth(1)).toContainText("Game-day special");
    await expect(section.locator("li").nth(1)).toContainText("E2E Football wings");
    await expect(section.locator("li").nth(1)).toContainText("1 – 4 PM");
    await expect(section.getByText("E2E Another day special")).toHaveCount(0);
    await expect(section.locator("li").nth(2)).toContainText("E2E Watch with us");
    await expect(section.locator("li").nth(2)).toContainText("Big screen Sunday");
    await expect(page.getByText("Please drink responsibly.")).toBeVisible();
    expect(await noSideways(page)).toBe(true);

    // The featured beer runs out: it leaves Home.
    await db.query(`update menu_items set available = false where id = $1`, [item]);
    await page.reload();
    await expect(page.getByRole("region", { name: "At the brewery" })).not.toContainText("Featured");
    await page.context().close();
  } finally {
    await clean(db);
    await db.close();
  }
});

test("with nothing posted a player sees the standard Watch with us message", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    await clean(db);
    const page = await player(browser, db, nextSeason++, "brewerynone");
    await page.goto("/");
    const section = page.getByRole("region", { name: "At the brewery" });
    await expect(section.locator("li")).toHaveCount(1);
    await expect(section).toContainText("Watch with us");
    await expect(section).toContainText("Sunday games on the big screen.");
    await page.context().close();
  } finally {
    await clean(db);
    await db.close();
  }
});
