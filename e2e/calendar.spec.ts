import { expect, test, type Page } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";
import { apiCall } from "./helpers/api";

// The calendar: an admin adds a one-off and a weekly entry, anyone sees the next 7 days on a phone,
// one day of the series is changed and one cancelled without touching the others, music shows
// without being typed twice, and a TV plays the next 7 days as day cards. Rows are named "E2E ...".

const TV = { width: 1280, height: 720 };
const noSideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const easternToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
const plusDays = (date: string, n: number) => new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10) + n)).toISOString().slice(0, 10);

async function clean(db: TestDb) {
  await db.query(`delete from calendar_entries where title like 'E2E %'`);
  await db.query(`delete from music_events where title like 'E2E %'`);
  await db.query(`delete from tv_screens where name like 'E2E %'`);
  await db.query(`delete from tv_playlists where name like 'E2E %'`);
}

const dayCard = (page: Page, date: string) => page.getByTestId("calendar-day").and(page.locator(`[aria-label="${labelOf(date)}"]`));
const labelOf = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).replace(/,/g, "");

test("an admin builds the calendar and anyone reads it: week list, links, one changed day, one cancelled day, music, wrong dates", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    await clean(db);
    const today = easternToday();
    const tomorrow = plusDays(today, 1);
    const nextWeek = plusDays(today, 7);
    await db.query(`insert into music_events (title, event_date, start_time) values ('E2E The Band', $1, '20:00')`, [plusDays(today, 3)]);

    const larkEmail = db.email("calendarlark");
    const lark = await signIn(browser, db, larkEmail);
    await db.setUser(larkEmail, "Lark Admin", true);

    // Add a one-off with a link to the kitchen menu.
    await lark.goto("/admin/more");
    await lark.getByRole("link", { name: /^Calendar/ }).click();
    await lark.waitForURL(/\/admin\/calendar(\?.*)?$/);
    await expect(lark.getByTestId("admin-calendar-day")).toHaveCount(7);
    expect(await noSideways(lark)).toBe(true);
    await lark.getByRole("link", { name: "Add to the calendar" }).click();
    await lark.getByLabel("Title").fill("E2E Taco Night");
    await lark.getByLabel("Type").selectOption("food");
    await lark.getByLabel("Date").fill(tomorrow);
    await lark.getByLabel("Starts (optional)").fill("17:00");
    await lark.getByLabel("Note (optional)").fill("Two for one until 8");
    await lark.getByLabel("Send people to").selectOption("kitchen");
    await lark.getByRole("button", { name: "Add to calendar" }).click();
    await lark.waitForURL(/\/admin\/calendar(\?.*)?$/);

    // Add a weekly entry starting today.
    await lark.getByRole("link", { name: "Add to the calendar" }).click();
    await lark.getByLabel("Title").fill("E2E Trivia");
    await lark.getByLabel("Date").fill(today);
    await lark.getByLabel("Starts (optional)").fill("19:00");
    await lark.getByLabel("How often").selectOption("weekly");
    await expect(lark.getByText(/^Every (Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\.$/)).toBeVisible();
    await lark.getByRole("button", { name: "Add to calendar" }).click();
    await lark.waitForURL(/\/admin\/calendar(\?.*)?$/);
    await expect(lark.getByTestId("admin-calendar-entry").filter({ hasText: "E2E Trivia" })).toContainText("repeats");
    await expect(lark.getByTestId("admin-calendar-entry").filter({ hasText: "E2E The Band" })).toContainText("from Music");

    // A bad link is refused with a clear message and nothing is saved.
    await lark.getByRole("link", { name: "Add to the calendar" }).click();
    await lark.getByLabel("Title").fill("E2E Bad Link");
    await lark.getByLabel("Send people to").selectOption("url");
    await lark.getByPlaceholder("https://").fill("javascript:alert(1)");
    await lark.getByRole("button", { name: "Add to calendar" }).click();
    await expect(lark.getByRole("alert")).toBeVisible();
    expect(Number((await db.query(`select count(*) as n from calendar_entries where title = 'E2E Bad Link'`)).rows[0].n)).toBe(0);

    // Anyone, signed out, sees the next 7 days on a phone.
    const visitor = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const phone = await visitor.newPage();
    await phone.goto("/menu/calendar");
    await expect(phone.getByRole("heading", { name: "Today", exact: false }).first()).toBeVisible();
    await expect(phone.getByTestId("calendar-day")).toHaveCount(7);
    await expect(dayCard(phone, today)).toContainText("E2E Trivia");
    await expect(dayCard(phone, today)).toContainText("7 PM");
    await expect(dayCard(phone, tomorrow)).toContainText("E2E Taco Night");
    await expect(dayCard(phone, tomorrow)).toContainText("Two for one until 8");
    await expect(dayCard(phone, tomorrow).getByTestId("calendar-tag")).toHaveText("Food special");
    await expect(dayCard(phone, plusDays(today, 3))).toContainText("E2E The Band");
    await expect(dayCard(phone, plusDays(today, 3)).getByTestId("calendar-tag")).toHaveText("Music");
    await expect(dayCard(phone, plusDays(today, 5))).toContainText("Nothing planned");
    expect(await noSideways(phone)).toBe(true);
    await expect(phone.getByRole("button", { name: "Earlier days" })).toBeDisabled();

    // The link goes to the kitchen menu.
    await dayCard(phone, tomorrow).getByRole("link", { name: "See the kitchen menu" }).click();
    await phone.waitForURL("**/menu/kitchen");
    await phone.goBack();

    // Next 7 days: the weekly entry repeats, the one-off is gone, and Back to today returns.
    await phone.getByRole("button", { name: "Later days" }).click();
    await expect(phone).toHaveURL(new RegExp(`from=${nextWeek}`));
    await expect(dayCard(phone, nextWeek)).toContainText("E2E Trivia");
    await expect(phone.getByText("E2E Taco Night")).toHaveCount(0);
    await phone.getByRole("button", { name: "Back to today" }).click();
    await expect(phone).not.toHaveURL(/from=/);
    await expect(dayCard(phone, tomorrow)).toContainText("E2E Taco Night");

    // Lark changes next week's Trivia only, and cancels the week after.
    const id = (await db.query(`select id from calendar_entries where title = 'E2E Trivia'`)).rows[0].id as string;
    const week3 = plusDays(today, 14);
    await lark.goto(`/admin/calendar/${id}?date=${nextWeek}`);
    await expect(lark.getByText('"E2E Trivia" repeats. What do you want to change?')).toBeVisible();
    await lark.getByRole("button", { name: /^Just / }).click();
    await expect(lark.getByText(/This changes .* only\./)).toBeVisible();
    await lark.getByLabel("Title").fill("E2E Trivia finals");
    await lark.getByLabel("Starts (optional)").fill("20:00");
    await lark.getByRole("button", { name: "Save" }).click();
    await lark.waitForURL(/\/admin\/calendar\?from=/);

    await lark.goto(`/admin/calendar/${id}?date=${week3}`);
    await lark.getByRole("button", { name: /^Just / }).click();
    await lark.getByRole("button", { name: "Cancel this day" }).click();
    await lark.getByRole("button", { name: "Yes, cancel it" }).click();
    await lark.waitForURL(/\/admin\/calendar\?from=/);

    await phone.goto(`/menu/calendar?from=${nextWeek}`);
    await expect(dayCard(phone, nextWeek)).toContainText("E2E Trivia finals");
    await expect(dayCard(phone, nextWeek)).toContainText("8 PM");
    await phone.goto(`/menu/calendar?from=${week3}`);
    await expect(dayCard(phone, week3)).not.toContainText("E2E Trivia");
    await phone.goto(`/menu/calendar?from=${plusDays(today, 21)}`);
    await expect(dayCard(phone, plusDays(today, 21))).toContainText("E2E Trivia");
    await phone.goto("/menu/calendar");
    await expect(dayCard(phone, today)).toContainText("E2E Trivia"); // today is unchanged

    // Editing all keeps the changed day, and removing the series clears every day.
    await lark.goto(`/admin/calendar/${id}?date=${today}`);
    await lark.getByRole("button", { name: "All in the series" }).click();
    await lark.getByLabel("Title").fill("E2E Trivia night");
    await lark.getByRole("button", { name: "Save" }).click();
    await lark.waitForURL(/\/admin\/calendar\?from=/);
    await phone.goto(`/menu/calendar?from=${nextWeek}`);
    await expect(dayCard(phone, nextWeek)).toContainText("E2E Trivia finals");
    await lark.goto(`/admin/calendar/${id}?date=${today}`);
    await lark.getByRole("button", { name: "All in the series" }).click();
    await lark.getByRole("button", { name: "Remove the series" }).click();
    await lark.getByRole("button", { name: "Yes, remove it" }).click();
    await lark.waitForURL(/\/admin\/calendar\?from=/);
    expect(Number((await db.query(`select count(*) as n from calendar_entries where title like 'E2E Trivia%'`)).rows[0].n)).toBe(0);
    expect(Number((await db.query(`select count(*) as n from calendar_exceptions where entry_id = $1`, [id])).rows[0].n)).toBe(0);

    // A date too far away says so.
    await phone.goto("/menu/calendar?from=2099-01-01");
    await expect(phone.getByText("That date is too far away.")).toBeVisible();

    // A player cannot reach the admin screens or their API.
    const playerEmail = db.email("calendarplayer");
    const player = await signIn(browser, db, playerEmail);
    await db.setUser(playerEmail, "Pat Plain");
    expect((await apiCall(player, "POST", "/calendar/entries", { title: "E2E Nope", date: today, type: "event", repeat: "none" })).status).toBe(403);
    await player.goto("/admin/calendar");
    await expect(player.getByRole("heading", { name: "Calendar" })).toHaveCount(0);
    // A signed-in player sees the calendar inside the app, with the Menu tab.
    await player.goto("/menu/calendar");
    await expect(player.getByTestId("calendar-day")).toHaveCount(7);

    await visitor.close();
    await lark.context().close();
    await player.context().close();
  } finally {
    await clean(db);
    await db.close();
  }
});

test("a TV plays the next 7 days as day cards: today first, tags, +N more, nothing planned, no links", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    await clean(db);
    const today = easternToday();
    // A busy day (six entries, so four show and "+2 more"), a quiet rest, one entry with a link.
    for (let i = 1; i <= 6; i++) {
      await db.query(`insert into calendar_entries (title, entry_date, type, start_time, repeat) values ($1, $2, 'event', $3, 'none')`, [`E2E Busy ${i}`, plusDays(today, 1), `1${i}:00`]);
    }
    await db.query(`insert into calendar_entries (title, entry_date, type, repeat, link_kind, link_target) values ('E2E Closed Monday', $1, 'closed', 'none', 'app', 'menu')`, [today]);
    const playlistId = (await db.query(`insert into tv_playlists (name) values ('E2E Cal List') returning id`)).rows[0].id as string;
    await db.query(`insert into tv_playlist_slides (playlist_id, kind, position, seconds, enabled) values ($1, 'calendar', 0, 15, true)`, [playlistId]);
    const code = "e2e-calendar-code-0123456789abcdefghijklmnopqrstuvwxyz";
    await db.query(`insert into tv_screens (name, code, playlist_id) values ('E2E Cal TV', $1, $2)`, [code, playlistId]);

    const ctx = await browser.newContext({ viewport: TV });
    const tv = await ctx.newPage();
    await tv.goto(`/tv/${code}`);
    await expect(tv.getByTestId("tv-calendar")).toBeVisible();
    await expect(tv.getByTestId("tv-calendar-day")).toHaveCount(7);
    const first = tv.getByTestId("tv-calendar-day").first();
    await expect(first).toHaveAttribute("data-today", "true");
    await expect(first).toContainText("Today");
    await expect(first).toContainText("E2E Closed Monday");
    await expect(first.getByTestId("calendar-tag")).toHaveText("Closed");
    // The busy day shows four lines and counts the rest.
    const busy = tv.getByTestId("tv-calendar-day").nth(1);
    await expect(busy.getByTestId("tv-calendar-entry")).toHaveCount(4);
    await expect(busy.getByTestId("tv-calendar-more")).toHaveText("+2 more");
    // A quiet day says so, and nothing on the TV is a link.
    await expect(tv.getByTestId("tv-calendar-day").nth(4)).toContainText("Nothing planned");
    await expect(tv.getByTestId("tv-calendar").getByRole("link")).toHaveCount(0);
    // Everything fits the 1280 by 664 slide area.
    const slide = (await tv.getByTestId("tv-slide").boundingBox())!;
    const cal = (await tv.getByTestId("tv-calendar").boundingBox())!;
    expect(cal.y + cal.height).toBeLessThanOrEqual(slide.y + slide.height + 1);
    for (const card of await tv.getByTestId("tv-calendar-day").all()) {
      const box = (await card.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(slide.y + slide.height + 1);
    }
    await ctx.close();

    // With nothing in the next 7 days the slide is skipped and the TV says there is nothing to show.
    await db.query(`delete from calendar_entries where title like 'E2E %'`);
    const empty = await browser.newContext({ viewport: TV });
    const page2 = await empty.newPage();
    await page2.goto(`/tv/${code}`);
    await expect(page2.getByTestId("tv-empty")).toContainText("Nothing to show yet");
    await empty.close();
  } finally {
    await clean(db);
    await db.close();
  }
});
