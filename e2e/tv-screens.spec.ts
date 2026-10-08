import { expect, test } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";
import { apiCall } from "./helpers/api";
import { E2E_OPERATOR_EMAIL } from "./env";

// TV screens: the site owner adds a screen, an admin builds a playlist and points the screen at it,
// the private link plays it signed out (slides rotate, the QR strip follows its setting), and a
// reset kills the old link. Rows are named "E2E ..." and removed at the start and the end.

const SEASON = 2954;
const TV = { width: 1280, height: 720 };

async function clean(db: TestDb) {
  await db.query(`delete from tv_screens where name like 'E2E %'`);
  await db.query(`delete from tv_playlists where name like 'E2E %'`);
  await db.query(`delete from menu_items where name like 'E2E %'`);
  await db.query(`delete from music_events where title like 'E2E %'`);
}

test("set up a screen, build a playlist, play it on the private link, change it, and reset the link", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    await clean(db);
    await db.query(`insert into menu_items (kind, section, name, style, abv, sort_order, available) values ('beer', 'On tap', 'E2E Hazy Beer', 'IPA', '6%', 9301, true)`);
    const soon = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
    await db.query(`insert into music_events (title, event_date, start_time) values ('E2E Band Night', $1, '20:00')`, [soon]);
    const poolId = await db.createPool("E2E TV Pool", SEASON, "survivor");
    await db.createGame(SEASON, 1, "KC", "BUF");
    await db.createEntry(poolId, await db.createPlayer("tvplayer", "Tina Tv"));

    const god = await signIn(browser, db, db.adopt(E2E_OPERATOR_EMAIL));
    const larkEmail = db.email("tvlark");
    const lark = await signIn(browser, db, larkEmail);
    await db.setUser(larkEmail, "Lark Admin", true);

    // The site owner adds a screen and copies its private link.
    await god.goto("/admin/more");
    await god.getByRole("link", { name: /^TV screens setup/ }).click();
    await god.waitForURL("**/admin/setup/tv");
    await god.getByLabel("Add a screen").fill("E2E Bar TV");
    await god.getByRole("button", { name: "Add screen" }).click();
    await expect(god.getByTestId("setup-screen")).toContainText("E2E Bar TV");
    const link = await god.getByRole("textbox", { name: "Link for E2E Bar TV" }).inputValue();
    expect(link).toMatch(/\/tv\/[A-Za-z0-9_-]{43}$/);

    // An ordinary admin cannot set screens up or see links.
    await lark.goto("/admin/setup/tv");
    await expect(lark.getByRole("textbox", { name: /^Link for/ })).toHaveCount(0);
    expect((await apiCall(lark, "POST", "/tv/screens", { name: "E2E Nope" })).status).toBe(403);
    expect(JSON.stringify((await apiCall(lark, "GET", "/tv")).json)).not.toContain(link.split("/tv/")[1]!);

    // Lark builds a playlist: standings, drinks, music.
    await lark.goto("/admin/tv");
    await expect(lark.getByTestId("tv-screen")).toContainText("E2E Bar TV");
    await lark.getByRole("link", { name: "New playlist" }).click();
    await lark.waitForURL("**/admin/tv/playlists/new");
    await lark.getByLabel("Name").fill("E2E Game day");
    for (const kind of ["Standings", "Drinks", "Music"]) await lark.getByRole("button", { name: kind, exact: true }).click();
    await expect(lark.getByTestId("tv-slide-row")).toHaveCount(3);
    await lark.getByTestId("tv-slide-row").first().getByLabel("Pool").selectOption(poolId);
    await lark.getByTestId("tv-slide-row").nth(1).getByLabel("Seconds").fill("20");
    await lark.getByTestId("tv-slide-row").nth(2).getByLabel("Seconds").fill("10");
    await lark.getByRole("button", { name: "Move Music up" }).click();
    await lark.getByRole("button", { name: "Move Music down" }).click();
    await lark.getByRole("button", { name: "Save playlist" }).click();
    await lark.waitForURL("**/admin/tv");
    await expect(lark.getByTestId("tv-playlist")).toContainText("Standings, Drinks, Music");

    // She points the screen at it.
    const row = lark.getByTestId("tv-screen").filter({ hasText: "E2E Bar TV" });
    await row.getByLabel("Plays").selectOption({ label: "E2E Game day" });
    await expect(lark.getByTestId("tv-playlist")).toContainText("on E2E Bar TV");

    // The TV opens the private link with no sign-in and the slides rotate.
    const ctx = await browser.newContext({ viewport: TV });
    const tv = await ctx.newPage();
    await tv.clock.install({ time: new Date() });
    await tv.goto(link);
    await expect(tv.getByTestId("tv-slide")).toContainText("E2E TV Pool");
    await expect(tv.getByTestId("tv-slide")).toContainText("of 1 still alive");
    await expect(tv.locator("header")).toHaveCount(0);
    const strip = tv.getByTestId("tv-strip");
    await expect(strip).toContainText("Play on your phone");
    await expect(strip.getByRole("img", { name: /QR code/ })).toHaveAttribute("data-url", new RegExp(`^http://localhost:5183$`));
    const stripBox = (await strip.boundingBox())!;
    expect(stripBox.height).toBeGreaterThan(40);
    expect(stripBox.height).toBeLessThan(70);

    await tv.clock.fastForward(16_000);
    await expect(tv.getByTestId("tv-menu")).toHaveAttribute("data-title", "Drinks");
    await expect(tv.getByTestId("tv-menu")).toContainText("E2E Hazy Beer");
    await expect(strip.getByRole("img", { name: /QR code/ })).toHaveAttribute("data-url", /\/menu$/);
    await tv.clock.fastForward(21_000);
    await expect(tv.getByTestId("tv-music")).toContainText("E2E Band Night");
    await tv.clock.fastForward(11_000);
    await expect(tv.getByTestId("tv-slide")).toContainText("E2E TV Pool"); // round again

    // Lark turns the QR strip off and a slide off; the TV follows on its next refresh.
    await row.getByLabel(/Show "Play on your phone"/).click();
    await expect(row.getByLabel(/Show "Play on your phone"/)).not.toBeChecked();
    await tv.clock.fastForward(31_000);
    await expect(tv.getByTestId("tv-strip")).toHaveCount(0);

    // A new TV on the same link sees the same thing, and no signed-in person is needed.
    // The site owner resets the link: the old one stops, the screen keeps its playlist.
    await god.reload();
    await god.getByRole("button", { name: "Reset link for E2E Bar TV" }).click();
    await god.getByRole("button", { name: "Yes, reset it" }).click();
    await expect(god.getByText("The link was reset. Open the new link on the TV.")).toBeVisible();
    const fresh = await god.getByRole("textbox", { name: "Link for E2E Bar TV" }).inputValue();
    expect(fresh).not.toBe(link);
    await tv.clock.fastForward(31_000);
    await expect(tv.getByTestId("tv-gone")).toHaveText("This TV link is no longer active");

    const again = await browser.newContext({ viewport: TV });
    const page2 = await again.newPage();
    await page2.goto(fresh);
    await expect(page2.getByTestId("tv-slide")).toContainText("E2E TV Pool");
    await expect(page2.getByTestId("tv-strip")).toHaveCount(0); // the setting survived the reset
    await again.close();

    // With nothing to play the TV says so, with the screen's name.
    await row.getByLabel("Plays").selectOption({ label: "Nothing" });
    await expect(lark.getByTestId("tv-playlist")).not.toContainText("on E2E Bar TV");
    const empty = await browser.newContext({ viewport: TV });
    const page3 = await empty.newPage();
    await page3.goto(fresh);
    await expect(page3.getByTestId("tv-empty")).toContainText("Nothing to show yet");
    await expect(page3.getByTestId("tv-empty")).toContainText("E2E Bar TV");
    await empty.close();

    await ctx.close();
    await god.context().close();
    await lark.context().close();
  } finally {
    await clean(db);
    await db.close();
  }
});

test("a signed-out visitor with a wrong link sees only that it is not active", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: TV });
  const page = await ctx.newPage();
  await page.goto("/tv/this-is-not-a-real-code-at-all-nothing-here");
  await expect(page.getByTestId("tv-gone")).toHaveText("This TV link is no longer active");
  await expect(page.getByTestId("tv-strip")).toHaveCount(0);
  await ctx.close();
});

test("an admin previews a screen and a playlist full-screen with a Close button; a real TV has none; a player cannot", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    await clean(db);
    await db.query(`insert into menu_items (kind, section, name, style, abv, sort_order, available) values ('beer', 'On tap', 'E2E Hazy Beer', 'IPA', '6%', 9301, true)`);
    const soon = new Date(Date.now() + 2 * 86400_000).toISOString().slice(0, 10);
    await db.query(`insert into music_events (title, event_date, start_time) values ('E2E Band Night', $1, '20:00')`, [soon]);
    const playlistId = (await db.query(`insert into tv_playlists (name) values ('E2E Preview List') returning id`)).rows[0].id as string;
    await db.query(`insert into tv_playlist_slides (playlist_id, kind, position, seconds, enabled) values ($1, 'drinks', 0, 20, true), ($1, 'music', 1, 10, true)`, [playlistId]);
    const code = "e2e-preview-code-0123456789abcdefghijklmnopqrstuvwxyz";
    const screenId = (await db.query(`insert into tv_screens (name, code, playlist_id) values ('E2E Preview TV', $1, $2) returning id`, [code, playlistId])).rows[0].id as string;

    const larkEmail = db.email("tvpreviewlark");
    const lark = await signIn(browser, db, larkEmail);
    await db.setUser(larkEmail, "Lark Admin", true);
    await lark.setViewportSize(TV);
    await lark.clock.install({ time: new Date() });

    // From a screen.
    await lark.goto("/admin/tv");
    await expect(lark.getByText("Preview shows the saved playlist.")).toBeVisible();
    await lark.getByRole("link", { name: "Preview E2E Preview TV" }).click();
    await lark.waitForURL(`**/admin/tv/preview/screens/${screenId}`);
    await expect(lark.getByTestId("tv-slide")).toContainText("E2E Hazy Beer");
    await expect(lark.getByTestId("tv-strip")).toContainText("Play on your phone");
    await expect(lark.getByTestId("tv-preview-close")).toBeVisible();
    await lark.clock.fastForward(21_000);
    await expect(lark.getByTestId("tv-music")).toContainText("E2E Band Night");
    await lark.getByRole("button", { name: "Close preview" }).click();
    await lark.waitForURL("**/admin/tv");

    // From a playlist in the list, and from its editor.
    await lark.getByRole("link", { name: "Preview E2E Preview List" }).click();
    await lark.waitForURL(`**/admin/tv/preview/playlists/${playlistId}`);
    await expect(lark.getByTestId("tv-slide")).toContainText("E2E Hazy Beer");
    await lark.getByRole("button", { name: "Close preview" }).click();
    await lark.waitForURL("**/admin/tv");
    await lark.goto(`/admin/tv/playlists/${playlistId}`);
    await expect(lark.getByText("Preview shows the saved playlist. Save your changes first.")).toBeVisible();
    await lark.getByRole("link", { name: "Preview", exact: true }).click();
    await lark.waitForURL(`**/admin/tv/preview/playlists/${playlistId}`);
    await expect(lark.getByTestId("tv-preview-close")).toBeVisible();
    await lark.getByRole("button", { name: "Close preview" }).click();
    await lark.waitForURL(`**/admin/tv/playlists/${playlistId}`);

    // A real TV on the private link has no Close button.
    const ctx = await browser.newContext({ viewport: TV });
    const tv = await ctx.newPage();
    await tv.goto(`/tv/${code}`);
    await expect(tv.getByTestId("tv-slide")).toContainText("E2E Hazy Beer");
    await expect(tv.getByTestId("tv-preview-close")).toHaveCount(0);
    await ctx.close();

    // A player gets nothing from a preview address or its API.
    const playerEmail = db.email("tvpreviewplayer");
    const player = await signIn(browser, db, playerEmail);
    await db.setUser(playerEmail, "Pat Plain");
    expect((await apiCall(player, "GET", `/tv/screens/${screenId}/preview`)).status).toBe(403);
    await player.goto(`/admin/tv/preview/screens/${screenId}`);
    await expect(player.getByTestId("tv-slide")).toHaveCount(0);
    await expect(player.getByTestId("tv-preview-close")).toHaveCount(0);

    await lark.context().close();
    await player.context().close();
  } finally {
    await clean(db);
    await db.close();
  }
});
