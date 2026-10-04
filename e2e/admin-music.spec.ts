import { expect, test, type Page } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";
import { API_URL } from "./env";

// The admin Music screens: the third Menu tab, the list, the add wizard (a quick day and another
// date), editing and removing. Events are named "E2E ..." and removed at the end.

const noSideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("an admin adds two events, edits one, and removes it", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    await db.query(`delete from music_events where title like 'E2E %'`);
    const email = db.email("musicadmin");
    const page = await signIn(browser, db, email);
    const adminId = await db.setUser(email, "Mo Music", true);
    const row = async (title: string) => (await db.query(`select title, event_date::text as d, start_time::text as s, end_time::text as e from music_events where title = $1`, [title])).rows[0];
    const later = (await db.query(`select ((now() at time zone 'America/Toronto')::date + 20)::text as d`)).rows[0].d as string;

    // The Music tab of the admin Menu.
    await page.goto("/admin/menu");
    await page.getByRole("button", { name: "Music" }).click();
    await expect(page.getByRole("link", { name: "Add music or an event" })).toBeVisible();
    expect(await noSideways(page)).toBe(true);

    // Add one for the coming weekend with times.
    await page.getByRole("link", { name: "Add music or an event" }).click();
    await expect(page.locator('nav[aria-label="Admin"]')).toHaveCount(0);
    await expect(page.getByText("Step 1 of 3")).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click(); // no name yet
    await expect(page.getByText("Say who's playing.")).toBeVisible();
    await page.getByLabel("Name").fill("E2E Bradley McAree");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click(); // no day yet
    await expect(page.getByText("Pick a day.")).toBeVisible();
    await page.locator("button[aria-pressed]").filter({ hasText: /^(Fri|Sat|Sun) / }).last().click();
    await page.getByLabel("Starts").fill("13:00");
    await page.getByLabel("Ends").fill("16:00");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Players will see it in the Music tab.")).toBeVisible();
    await expect(page.getByText(/1 – 4 PM/)).toBeVisible();
    expect(await noSideways(page)).toBe(true);
    await page.getByRole("button", { name: "Add to the schedule" }).click();
    await expect(page.getByRole("heading", { name: "Added" })).toBeVisible();
    expect(await row("E2E Bradley McAree")).toMatchObject({ s: "13:00:00", e: "16:00:00" });

    // Add another on a date of its own, with no times.
    await page.getByRole("button", { name: "Add another" }).click();
    await page.getByLabel("Name").fill("E2E Band To Be Announced");
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Another date" }).click();
    await page.getByLabel("Date").fill(later);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Add to the schedule" }).click();
    await expect(page.getByRole("heading", { name: "Added" })).toBeVisible();
    expect(await row("E2E Band To Be Announced")).toMatchObject({ d: later, s: null, e: null });

    // Both are in the list, and the public page shows them.
    await page.getByRole("link", { name: "Back to the music" }).click();
    await page.waitForURL("**/admin/menu?tab=music");
    await expect(page.locator("li", { hasText: "E2E Bradley McAree" })).toContainText("1 – 4 PM");
    await expect(page.locator("li", { hasText: "E2E Band To Be Announced" })).toContainText("Time to be confirmed");
    const publicMusic = await (await fetch(`${API_URL}/public/music`)).json();
    const titles = [...publicMusic.thisWeekend, ...publicMusic.comingUp].map((e: { title: string }) => e.title);
    expect(titles).toContain("E2E Bradley McAree");

    // Edit one.
    await page.locator("li", { hasText: "E2E Band To Be Announced" }).getByRole("link").click();
    await page.getByLabel("Starts").fill("19:00");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved. Players can see the change now.")).toBeVisible();
    expect(await row("E2E Band To Be Announced")).toMatchObject({ s: "19:00:00" });
    expect(await noSideways(page)).toBe(true);

    // Remove it: it asks first.
    await page.getByRole("button", { name: "Remove E2E Band To Be Announced" }).click();
    await page.getByRole("button", { name: "Keep it" }).click();
    expect(await row("E2E Band To Be Announced")).toBeTruthy();
    await page.getByRole("button", { name: "Remove E2E Band To Be Announced" }).click();
    await page.getByRole("button", { name: "Yes, remove it" }).click();
    await page.waitForURL("**/admin/menu?tab=music");
    expect(await row("E2E Band To Be Announced")).toBeUndefined();

    // Every change is in Activity.
    const kinds = (await db.query(`select kind from admin_activity where actor_id = $1 and kind like 'music_event_%'`, [adminId])).rows.map((r) => r.kind as string);
    expect(kinds.sort()).toEqual(["music_event_added", "music_event_added", "music_event_changed", "music_event_removed"]);
    await page.context().close();
  } finally {
    await db.query(`delete from music_events where title like 'E2E %'`);
    await db.close();
  }
});
