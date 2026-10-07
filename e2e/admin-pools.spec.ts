import { expect, test, type Browser, type Page } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

// Pool management on a phone: the list, the Players roster (including restoring a player and
// adding people), Picks, Settings with the lock, delete, and the four-step new-pool wizard.

// Pool seasons are limited to 2000 to 2100, so these tests stay inside that range.
let nextSeason = 2080;

async function newAdmin(browser: Browser, db: TestDb, label: string, name: string) {
  const email = db.email(label);
  const page = await signIn(browser, db, email);
  const userId = await db.setUser(email, name, true);
  return { page, userId };
}
const noSideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const activity = async (db: TestDb, actorId: string, kind: string) =>
  (await db.query(`select summary, affects_own_entry from admin_activity where actor_id = $1 and kind = $2 order by created_at desc`, [actorId, kind])).rows;

test("the Pools list and a pool's tabs; Pick 'em pools have no Picks tab", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const S = nextSeason++;
    const { page, userId } = await newAdmin(browser, db, "list", "Lia List");
    const sv = await db.createPool("List Survivor", S);
    const pe = await db.createPool("List PickEm", S, "pick_em");
    const svName = (await db.query(`select name from pools where id = $1`, [sv])).rows[0].name as string;
    await db.createEntry(sv, userId);
    await db.createGame(S, 1, "KC", "BUF", 2);

    await page.goto("/admin/pools");
    await expect(page.getByRole("heading", { name: "Pools" })).toBeVisible();
    const row = page.locator("li", { hasText: svName });
    await expect(row).toContainText(`Survivor · ${S} · 1 player`);
    await expect(row).toContainText("Locked");
    await expect(page.getByRole("link", { name: "New pool" })).toBeVisible();
    expect(await noSideways(page)).toBe(true);

    await row.click();
    const tabs = page.getByRole("navigation", { name: "Pool sections" });
    await expect(tabs.getByRole("link")).toHaveText(["Players", "Picks", "Settings"]);
    await expect(tabs.getByRole("link", { name: "Players" })).toHaveAttribute("aria-current", "page");

    await page.goto(`/admin/pools/${pe}`);
    await expect(page.getByRole("navigation", { name: "Pool sections" }).getByRole("link")).toHaveText(["Players", "Settings"]);
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("Players: search, Show all, marks, restoring and eliminating a player, own entry, and adding people", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const S = nextSeason++;
    const { page, userId } = await newAdmin(browser, db, "roster", "Rhea Roster");
    const poolId = await db.createPool("Roster Survivor", S);
    const poolName = (await db.query(`select name from pools where id = $1`, [poolId])).rows[0].name as string;
    await db.createGame(S, 1, "KC", "BUF", 2);
    const mine = await db.createEntry(poolId, userId);
    const names = ["Ann Able", "Bo Baker", "Cy Cole", "Di Dunn", "Ed Ellis", "Flo Fox", "Gus Gray", "Zed Zimmer"];
    const ids: Record<string, string> = {};
    for (const n of names) ids[n] = await db.createEntry(poolId, await db.createPlayer(`p${n}`, n));
    const out = await db.createEntry(poolId, await db.createPlayer("pout", "Edna Out"), "eliminated");
    await db.query(`update entries set eliminated_week = 3 where id = $1`, [out]);
    await db.createInvitedEntry(poolId, `invited-${db.stamp}@example.test`, "Ivy Invited");
    void mine;

    await page.goto(`/admin/pools/${poolId}`);
    await expect(page.getByText("11 players, 10 alive")).toBeVisible();
    const rows = page.locator("main ul > li");
    await expect(rows).toHaveCount(8); // a short list
    await expect(rows.first()).toContainText("Rhea Roster");
    await expect(rows.first()).toContainText("You");
    await page.getByRole("button", { name: "Show all 11" }).click();
    await expect(rows).toHaveCount(11);
    await expect(rows.filter({ hasText: "Ivy Invited" })).toContainText("Invited");
    await expect(rows.filter({ hasText: "Edna Out" })).toContainText("Out wk 3");
    expect(await noSideways(page)).toBe(true);

    // Search covers the whole pool, not just the short list.
    await page.reload();
    await page.getByLabel("Find a player").fill("zimmer");
    await expect(page.locator("main ul > li")).toHaveCount(1);
    await expect(page.locator("main ul > li").getByText("Zed Zimmer", { exact: true })).toBeVisible();
    await page.getByLabel("Find a player").fill("nobody");
    await expect(page.getByText("No players match")).toBeVisible();
    await page.getByLabel("Find a player").fill("edna");

    // Restore the knocked-out player.
    await page.getByRole("button", { name: /Edna Out/ }).click();
    await expect(page.getByText("Use this to fix a mistake")).toBeVisible();
    await expect(page.getByText("This is your own entry.")).toHaveCount(0);
    await page.getByRole("button", { name: "Alive", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved. Edna Out is updated.")).toBeVisible();
    const status = async (id: string) => (await db.query(`select status, eliminated_week from entries where id = $1`, [id])).rows[0];
    expect(await status(out)).toMatchObject({ status: "alive", eliminated_week: null });
    expect((await activity(db, userId, "player_status_changed"))[0].summary).toBe(`Rhea Roster set Edna Out to alive in ${poolName}.`);

    // Eliminate someone: a week is required.
    await page.getByLabel("Find a player").fill("");
    await page.getByRole("button", { name: /Ann Able/ }).click();
    await page.getByRole("button", { name: "Out", exact: true }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Enter the week they went out")).toBeVisible();
    expect(await status(ids["Ann Able"]!)).toMatchObject({ status: "alive" });
    await page.getByLabel("Out in week").fill("4");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Saved. Ann Able is updated.")).toBeVisible();
    expect(await status(ids["Ann Able"]!)).toMatchObject({ status: "eliminated", eliminated_week: 4 });
    await expect(page.locator("li", { hasText: "Ann Able" })).toContainText("Out wk 4");

    // Your own entry says so, and the record is flagged.
    await page.getByRole("button", { name: /Rhea Roster/ }).click();
    await expect(page.getByText("This is your own entry, so another admin has to confirm a change to it.")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    // Add someone who has an account.
    const existingId = await db.createPlayer("existing", "Eve Existing");
    const existingEmail = await db.emailOf(existingId);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByLabel("Their email address").fill(existingEmail);
    await page.getByRole("button", { name: `Add to ${poolName}` }).click();
    await expect(page.getByText("Player added.")).toBeVisible();
    await page.getByLabel("Find a player").fill("eve existing");
    await expect(page.locator("main ul > li", { hasText: "Eve Existing" })).toHaveCount(1);
    await page.getByLabel("Find a player").fill("");

    // Add someone with no account: the form asks for a name.
    const newEmail = `new-${db.stamp}@example.test`;
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByLabel("Their email address").fill(newEmail);
    await page.getByRole("button", { name: `Add to ${poolName}` }).click();
    await expect(page.getByLabel("Their name")).toBeVisible();
    await page.getByLabel("Their name").fill("Nell Newcomer");
    await page.getByRole("button", { name: `Add to ${poolName}` }).click();
    await expect(page.getByText("Player added.")).toBeVisible();
    await page.getByLabel("Find a player").fill("nell");
    await expect(page.locator("li", { hasText: "Nell Newcomer" })).toContainText("Invited");
    await db.query(`delete from entries where invited_email = $1`, [newEmail]);
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("a wipeout waiting in a pool is flagged on its Players tab", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const S = nextSeason++;
    const { page, userId } = await newAdmin(browser, db, "wb", "Wes Banner");
    const poolId = await db.createPool("Banner Survivor", S);
    const e1 = await db.createEntry(poolId, userId);
    const e2 = await db.createEntry(poolId, await db.createPlayer("wbo", "Other"));
    const g = await db.createGame(S, 1, "KC", "BUF", -0.5);
    await db.addPick(e1, 1, "KC");
    await db.addPick(e2, 1, "KC");
    await db.query(`insert into wipeout_events (pool_id, week_number, game_id, candidate_entry_ids) values ($1, 1, $2, $3::jsonb)`, [poolId, g, JSON.stringify([e1, e2])]);

    await page.goto(`/admin/pools/${poolId}`);
    await expect(page.getByText("A decision is waiting.")).toBeVisible();
    await page.getByRole("link", { name: /A decision is waiting/ }).click();
    await expect(page.getByRole("heading", { name: "Everyone would be out" })).toBeVisible();
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("Picks: teams are hidden before the lock except your own; after the lock everyone's show with results", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const S = nextSeason++;
    const { page, userId } = await newAdmin(browser, db, "picks", "Pia Picks");
    const poolId = await db.createPool("Picks Survivor", S);
    const gameId = await db.createGame(S, 1, "KC", "BUF", 2);
    const mine = await db.createEntry(poolId, userId);
    const a = await db.createEntry(poolId, await db.createPlayer("pa", "Amy Picked"));
    const b = await db.createEntry(poolId, await db.createPlayer("pb", "Ben Picked"));
    await db.createEntry(poolId, await db.createPlayer("pc", "Cat Nopick"));
    await db.addPick(mine, 1, "KC");
    await db.addPick(a, 1, "BUF");
    await db.addPick(b, 1, "KC");

    await page.goto(`/admin/pools/${poolId}?tab=picks`);
    await expect(page.getByText("Teams are hidden until the week locks. That goes for everyone, admins too.")).toBeVisible();
    await expect(page.getByText("4 alive · 3 picked")).toBeVisible();
    await expect(page.locator("li", { hasText: "Pia Picks" })).toContainText("You · Chiefs, your pick");
    await expect(page.locator("li", { hasText: "Amy Picked" })).toContainText("Team hidden until the lock");
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/Bills|\bBUF\b/); // the other players' team never reaches the page
    await page.getByRole("button", { name: /^No pick/ }).click();
    await expect(page.locator("main ul > li")).toHaveCount(1);
    await expect(page.locator("li", { hasText: "Cat Nopick" })).toContainText("Hasn't picked");
    await page.getByRole("button", { name: /^Picked/ }).click();
    await expect(page.locator("main ul > li")).toHaveCount(3);

    // After the lock every team shows, with results.
    await db.setKickoffIn(gameId, -3600);
    await db.decideGame(gameId, "home_win");
    await db.setPickResult(mine, 1, "KC", "win");
    await db.setPickResult(a, 1, "BUF", "loss");
    await db.setPickResult(b, 1, "KC", "win");
    await page.reload();
    await expect(page.getByText("This week has locked, so everyone can see everyone's picks.")).toBeVisible();
    await expect(page.locator("li", { hasText: "Amy Picked" })).toContainText("Bills");
    await expect(page.locator("li", { hasText: "Amy Picked" })).toContainText("Lost");
    await expect(page.locator("li", { hasText: "Ben Picked" })).toContainText("Won");
    await page.getByRole("button", { name: /^Lost/ }).click();
    await expect(page.locator("main ul > li")).toHaveCount(1);
    expect(await noSideways(page)).toBe(true);
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("Settings: the rules lock and unlock, editing while unlocked, the total while locked, and delete by name", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const S = nextSeason++;
    const { page, userId } = await newAdmin(browser, db, "set", "Sol Settings");
    const poolId = await db.createPool("Settings Survivor", S);
    const poolName = (await db.query(`select name from pools where id = $1`, [poolId])).rows[0].name as string;

    await page.goto(`/admin/pools/${poolId}?tab=settings`);
    await expect(page.getByRole("heading", { name: "Rules are locked" })).toBeVisible();
    await expect(page.getByLabel("Name")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);

    // The total works while the rules are locked.
    await page.getByLabel("Shown to players on Standings").fill("150");
    await page.getByRole("button", { name: "Save pool total" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    expect((await db.query(`select pool_total_cents from pools where id = $1`, [poolId])).rows[0].pool_total_cents).toBe(15000);

    // Unlock, edit, save, lock again.
    await page.getByRole("button", { name: "Unlock the rules" }).click();
    await expect(page.getByRole("heading", { name: "Rules are unlocked" })).toBeVisible();
    await expect(page.getByLabel("Name")).toBeEnabled();
    await page.getByLabel("Name").fill(`${poolName} (edited)`);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect
      .poll(async () => (await db.query(`select name from pools where id = $1`, [poolId])).rows[0].name)
      .toBe(`${poolName} (edited)`);
    // When picks lock: a pool saved before the setting keeps the whole-week rule; an admin can switch it.
    const lockRule = page.getByLabel("When picks lock");
    await expect(lockRule).toHaveValue("first_kickoff_of_week");
    await lockRule.selectOption("per_game_kickoff");
    await expect(page.getByText(/Sunday and Monday teams can still be picked/)).toBeVisible();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect
      .poll(async () => (await db.query(`select rules->>'pick_deadline_rule' as r from pools where id = $1`, [poolId])).rows[0].r)
      .toBe("per_game_kickoff");

    // The reveal rule: saved with the other rules, then locked with them.
    const reveal = page.getByLabel("When other players' picks show");
    await expect(reveal).toHaveValue("at_lock");
    await reveal.selectOption("after_final_game");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect
      .poll(async () => (await db.query(`select rules->>'reveal_picks' as r from pools where id = $1`, [poolId])).rows[0].r)
      .toBe("after_final_game");
    await page.getByRole("button", { name: "Lock the rules" }).click();
    await expect(page.getByRole("heading", { name: "Rules are locked" })).toBeVisible();
    await expect(reveal).toBeDisabled();
    await expect(lockRule).toBeDisabled();
    expect((await activity(db, userId, "pool_unlocked")).length).toBe(1);
    expect((await activity(db, userId, "pool_locked")).length).toBe(1);

    // Delete needs the exact name.
    await page.getByRole("button", { name: "Delete pool…" }).click();
    await expect(page.getByText("This permanently deletes the pool, its players and all their picks. It can't be undone.")).toBeVisible();
    const del = page.getByRole("button", { name: "Delete pool", exact: true });
    await expect(del).toBeDisabled();
    await page.getByLabel("Type the pool's name").fill("wrong name");
    await expect(del).toBeDisabled();
    await page.getByLabel("Type the pool's name").fill(`${poolName} (edited)`);
    await expect(del).toBeEnabled();
    await del.click();
    await page.waitForURL("**/admin/pools");
    expect((await db.query(`select count(*) from pools where id = $1`, [poolId])).rows[0].count).toBe("0");
    expect((await activity(db, userId, "pool_deleted")).length).toBe(1);
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("the new-pool wizard opens a pool; Change a rule creates it unlocked and opens its settings", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    // A real-looking season: pool seasons are limited to 2000 to 2100.
    const S = 2097;
    const { page, userId } = await newAdmin(browser, db, "wiz", "Wiz Admin");
    await db.createGame(S, 1, "KC", "BUF", 2);
    const openName = `Wizard Open ${db.stamp}`;
    const draftName = `Wizard Draft ${db.stamp}`;

    await page.goto("/admin/pools");
    await page.getByRole("link", { name: "New pool" }).click();
    await page.waitForURL("**/admin/pools/new");
    await expect(page.locator('nav[aria-label="Admin"]')).toHaveCount(0); // a task screen: no tab bar
    await expect(page.getByText("Step 1 of 4")).toBeVisible();
    await expect(page.getByRole("button", { name: "Next" })).toBeDisabled(); // a name is needed
    await page.getByLabel("Pool name").fill(openName);
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByRole("heading", { name: "How will people play?" })).toBeVisible();
    await expect(page.getByText("You can't change this later.")).toBeVisible();
    await page.getByRole("button", { name: /^Pick 'em/ }).click();
    await page.getByRole("button", { name: "Next" }).click();

    await expect(page.getByRole("heading", { name: "Check the rules" })).toBeVisible();
    await expect(page.getByText("Every game, every week")).toBeVisible();
    await page.getByRole("button", { name: "These look right" }).click();

    await expect(page.getByRole("heading", { name: "Ready to open?" })).toBeVisible();
    await expect(page.getByText(openName)).toBeVisible();
    await page.getByLabel("Season").selectOption(String(S));
    await page.getByRole("button", { name: "Open the pool" }).click();
    await expect(page.getByRole("heading", { name: `${openName} is open` })).toBeVisible();
    await expect(page.getByText("Players can join now.")).toBeVisible();
    const [opened] = await db.adoptPool(openName);
    expect((await db.query(`select type, status, season_year from pools where id = $1`, [opened])).rows[0]).toMatchObject({ type: "pick_em", status: "active", season_year: S });

    // Change a rule: created unlocked, settings open.
    await page.goto("/admin/pools/new");
    await page.getByLabel("Pool name").fill(draftName);
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Change a rule" }).click();
    await page.waitForURL(/\/admin\/pools\/[^/]+\?tab=settings/);
    await expect(page.getByRole("heading", { name: "Rules are unlocked" })).toBeVisible();
    await db.adoptPool(draftName);
    expect((await db.query(`select status from pools where name = $1`, [draftName])).rows[0].status).toBe("draft");
    expect((await activity(db, userId, "pool_created")).length).toBe(2);
    await page.context().close();
  } finally {
    await db.close();
  }
});
