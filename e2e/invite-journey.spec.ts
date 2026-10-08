import { expect, test } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";
import { API_URL, WEB_URL } from "./env";

// Inviting players: a brand-new person follows a shared pool link on a fresh phone, signs in with the
// emailed link, lands on the join page, gives a name, joins, picks and sees it saved (including a pool
// that started late); the invite button shares or copies a link with nothing private in it; and the
// TV's Standings strip sends people to the pool's join page.

const PHONE = { width: 390, height: 844 };
const TV = { width: 1280, height: 720 };

test("a brand-new person follows a shared link, signs in, names themselves, joins a late-started pool and picks", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2953;
    const poolId = await db.createPool("Late Start Survivor", SEASON, "survivor");
    const poolName = (await db.query(`select name from pools where id = $1`, [poolId])).rows[0].name as string;
    // Weeks 1 to 4 were played before anyone joined (decided, no picks); week 5 is the one to pick for.
    for (const [week, home, away] of [[1, "KC", "BUF"], [2, "DET", "NYJ"], [3, "PHI", "DAL"], [4, "SF", "SEA"]] as const) {
      const g = await db.createGame(SEASON, week, home, away);
      await db.setKickoffIn(g, -(12 - week) * 86400);
      await db.decideGame(g, "home_win");
    }
    await db.createGame(SEASON, 5, "MIA", "NE", 2);
    await db.createEntry(poolId, await db.createPlayer("host", "Hank Host"));

    // A fresh phone, signed out, opens the shared link.
    const context = await browser.newContext({ viewport: PHONE });
    const phone = await context.newPage();
    await phone.goto(`/join/${poolId}`);
    await expect(phone.getByRole("heading", { name: "Sign in to play" })).toBeVisible();

    // Asking for the email link sends the join page as the place to come back to.
    const email = db.email("newcomer");
    await phone.getByPlaceholder("you@example.com").fill(email);
    const request = phone.waitForRequest((r) => r.url().includes("/api/auth/sign-in/magic-link") && r.method() === "POST");
    await phone.getByRole("button", { name: "Email me a sign-in link" }).click();
    const sent = (await request).postDataJSON() as { callbackURL: string };
    expect(sent.callbackURL).toBe(`${WEB_URL}/join/${poolId}`);
    await expect(phone.getByRole("heading", { name: "Check your email" })).toBeVisible();

    // Opening the emailed link (the token is read from the test database, as the helper does) lands on the join page.
    const { rows } = await db.query(`select identifier from verification where value like $1 order by created_at desc limit 1`, [`%${email}%`]);
    await phone.goto(`${API_URL}/api/auth/magic-link/verify?token=${rows[0].identifier}&callbackURL=${encodeURIComponent(sent.callbackURL)}`);
    await phone.waitForURL(`**/join/${poolId}`);
    await expect(phone.getByRole("heading", { name: poolName })).toBeVisible();
    await expect(phone.getByText("How this pool works")).toBeVisible();

    // A new account is asked for a display name before it can join; the email is never offered as a name.
    await expect(phone.getByLabel("What should other players call you?")).toBeVisible();
    await expect(phone.getByRole("button", { name: `Join ${poolName}` })).toHaveCount(0);
    await phone.getByLabel("What should other players call you?").fill(email);
    await phone.getByRole("button", { name: "Save name and continue" }).click();
    await expect(phone.getByRole("alert")).toBeVisible(); // an email is not a name
    await phone.getByLabel("What should other players call you?").fill("Nia Newcomer");
    await phone.getByRole("button", { name: "Save name and continue" }).click();
    await expect(phone.getByText("You'll join as")).toBeVisible();
    await expect(phone.getByText("Nia Newcomer", { exact: true })).toBeVisible();

    // Join, and pick for the current week.
    await phone.getByRole("button", { name: `Join ${poolName}` }).click();
    await phone.waitForURL(new RegExp(`/pool/${poolId}/entry/[^/]+/pick$`));
    await expect(phone.getByRole("heading", { name: "Week 5 pick" })).toBeVisible();
    await phone.getByRole("button", { name: /^MIA/ }).click();
    await phone.getByRole("button", { name: "Lock in Dolphins" }).click();
    await expect(phone.getByRole("heading", { name: "Locked in" })).toBeVisible();

    // It is saved on the server under the name they gave, not their email.
    const saved = await db.query(
      `select p.team_code, u.name from picks p join entries e on e.id = p.entry_id join "user" u on u.id = e.user_id where e.pool_id = $1 and u.email = $2`,
      [poolId, email]
    );
    expect(saved.rows).toEqual([{ team_code: "MIA", name: "Nia Newcomer" }]);

    // Standings show the late start as a free pass and the new player by name only.
    await phone.goto(`/pool/${poolId}?view=weeks`);
    await expect(phone.getByTestId("grid-free-pass")).toHaveText("No picks were made in weeks 1 to 4 (the pool started late), so everyone got a free pass.");
    await expect(phone.getByTestId("grid-row").filter({ hasText: "Nia Newcomer" })).toBeVisible();
    expect(await phone.getByTestId("pick-grid").innerText()).not.toContain("@");
    await phone.goto(`/pool/${poolId}`);
    await expect(phone.getByText("Nia Newcomer")).toBeVisible();
    expect(await phone.locator("main").innerText()).not.toContain(email);

    // Following the same link again, already in the pool, goes straight to their pick screen.
    await phone.goto(`/join/${poolId}`);
    await phone.waitForURL(new RegExp(`/pool/${poolId}/entry/[^/]+/pick$`));
    await context.close();
  } finally {
    await db.close();
  }
});

test("Invite a friend shares or copies a link to the pool's join page, with nothing private in it", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2952;
    const email = db.email("inviter");
    const page = await signIn(browser, db, email);
    const userId = await db.setUser(email, "Pia Inviter");
    const poolId = await db.createPool("Invite Pool", SEASON, "survivor");
    const otherPool = await db.createPool("Not My Pool", SEASON, "survivor");
    await db.createGame(SEASON, 1, "KC", "BUF", 2);
    await db.createEntry(poolId, userId);
    const joinUrl = `${WEB_URL}/join/${poolId}`;

    // No share sheet and a clipboard we can read: the link is copied.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
      const copied: string[] = [];
      (window as unknown as { __copied: string[] }).__copied = copied;
      Object.defineProperty(navigator, "clipboard", { value: { writeText: async (t: string) => void copied.push(t) }, configurable: true });
    });
    await page.goto("/");
    await expect(page.getByTestId("invite")).toBeVisible();
    await page.getByRole("button", { name: "Invite a friend" }).click();
    await expect(page.getByRole("button", { name: "Link copied" })).toBeVisible();
    const copied = await page.evaluate(() => (window as unknown as { __copied: string[] }).__copied);
    expect(copied).toEqual([joinUrl]);
    expect(copied[0]).not.toContain("@");
    expect(copied[0]).not.toContain(email);
    expect(copied[0]).not.toContain("Pia");

    // The Standings page has it too, for a pool the player is in only.
    await page.goto(`/pool/${poolId}`);
    await expect(page.getByTestId("invite")).toBeVisible();
    await page.goto(`/pool/${otherPool}`);
    await expect(page.getByTestId("invite")).toHaveCount(0);

    // With a share sheet, it is used with the join link and a message that names only the pool.
    await page.addInitScript(() => {
      const shared: { title?: string; text?: string; url?: string }[] = [];
      (window as unknown as { __shared: typeof shared }).__shared = shared;
      Object.defineProperty(navigator, "share", { value: async (d: (typeof shared)[number]) => void shared.push(d), configurable: true });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Invite a friend" }).click();
    const shared = await page.evaluate(() => (window as unknown as { __shared: { text: string; url: string }[] }).__shared);
    expect(shared).toHaveLength(1);
    expect(shared[0]!.url).toBe(joinUrl);
    expect(shared[0]!.text).toMatch(/^Join me in Invite Pool /);
    expect(shared[0]!.text).toContain("at Bancroft Brewing's Brew Bowl");
    expect(shared[0]!.text).not.toContain("@");

    // A finished pool offers no invite.
    await db.query(`update pools set status = 'completed' where id = $1`, [poolId]);
    await page.goto(`/pool/${poolId}`);
    await expect(page.getByTestId("invite")).toHaveCount(0);
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("a TV's Standings strip sends people to the pool's join page, until the pool finishes", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2951;
    await db.query(`delete from tv_screens where name like 'E2E %'`);
    await db.query(`delete from tv_playlists where name like 'E2E %'`);
    const poolId = await db.createPool("Strip Pool", SEASON, "survivor");
    const poolName = (await db.query(`select name from pools where id = $1`, [poolId])).rows[0].name as string;
    await db.createGame(SEASON, 1, "KC", "BUF", 2);
    const playlistId = (await db.query(`insert into tv_playlists (name) values ('E2E Join List') returning id`)).rows[0].id as string;
    await db.query(`insert into tv_playlist_slides (playlist_id, kind, pool_id, position, seconds, enabled) values ($1, 'standings', $2, 0, 15, true), ($1, 'music', null, 1, 10, true)`, [playlistId, poolId]);
    const code = "e2e-join-strip-code-0123456789abcdefghijklmnopqrstuvwxyz";
    await db.query(`insert into tv_screens (name, code, playlist_id) values ('E2E Join TV', $1, $2)`, [code, playlistId]);
    await db.query(`insert into music_events (title, event_date, start_time) values ('E2E Band', current_date + 2, '20:00')`);

    const ctx = await browser.newContext({ viewport: TV });
    const tv = await ctx.newPage();
    await tv.clock.install({ time: new Date() });
    await tv.goto(`/tv/${code}`);
    const strip = tv.getByTestId("tv-strip");
    await expect(strip).toContainText(`Scan to join ${poolName}`);
    await expect(strip.getByRole("img", { name: /QR code/ })).toHaveAttribute("data-url", `${WEB_URL}/join/${poolId}`);

    // The music slide keeps the home address.
    await tv.clock.fastForward(16_000);
    await expect(tv.getByTestId("tv-music")).toBeVisible();
    await expect(strip.getByRole("img", { name: /QR code/ })).toHaveAttribute("data-url", WEB_URL);
    await expect(strip).toContainText("Scan to sign in");

    // A finished pool no longer takes players, so the strip falls back to the home address.
    await db.query(`update pools set status = 'completed' where id = $1`, [poolId]);
    await tv.clock.fastForward(31_000);
    await tv.clock.fastForward(11_000);
    await expect(tv.getByTestId("tv-slide")).toContainText(poolName);
    await expect(strip.getByRole("img", { name: /QR code/ })).toHaveAttribute("data-url", WEB_URL);
    await expect(strip).not.toContainText("Scan to join");
    await ctx.close();
  } finally {
    await db.query(`delete from tv_screens where name like 'E2E %'`);
    await db.query(`delete from tv_playlists where name like 'E2E %'`);
    await db.query(`delete from music_events where title like 'E2E %'`);
    await db.close();
  }
});
