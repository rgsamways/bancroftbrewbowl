import { expect, test, type Browser, type Page } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

// The admin steps: the Next step card, results one game at a time, the results list and
// corrections, and the wipeout decision. The admin summary looks at the latest season that has
// games, so each test uses a season far above everything else, and a new one each time.

let nextSeason = 3600;

async function newAdmin(browser: Browser, db: TestDb, label: string, name: string) {
  const email = db.email(label);
  const page = await signIn(browser, db, email);
  const userId = await db.setUser(email, name, true);
  return { page, userId };
}

const noSideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("Next step shows the waiting results; the wizard saves answers, can skip, and tells the truth at the end", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const S = nextSeason++;
    const { page } = await newAdmin(browser, db, "ns", "Nina Next");
    const g1 = await db.createGame(S, 1, "KC", "BUF", -0.2); // kicked off
    const g2 = await db.createGame(S, 1, "DAL", "PHI", -0.1); // kicked off
    await db.createGame(S, 1, "SEA", "SF", 2); // still to be played: not waiting
    const poolId = await db.createPool("Steps Survivor", S);
    const poolName = (await db.query(`select name from pools where id = $1`, [poolId])).rows[0].name as string;

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Hi there" })).toBeVisible();
    await expect(page.getByText("Week 1 · here's what to do next.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Enter the 2 results still waiting" })).toBeVisible();
    await expect(page.getByText(/Bills vs Chiefs and Eagles vs Cowboys/)).toBeVisible();
    await expect(page.getByText("0 of 3 entered")).toBeVisible();
    await expect(page.getByText(`0 alive of 0`)).toBeVisible();
    await expect(page.getByText(poolName)).toBeVisible();
    expect(await noSideways(page)).toBe(true);

    // Walk through: answer the first, skip the second.
    await page.getByRole("link", { name: "Start" }).click();
    await page.waitForURL("**/admin/results/steps");
    await expect(page.locator('nav[aria-label="Admin"]')).toHaveCount(0); // no tab bar on a task screen
    await expect(page.getByText("Step 1 of 2")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Who won?" })).toBeVisible();
    await expect(page.getByText("Your answer counts in every pool this season, so you only do this once per game.")).toBeVisible();
    await page.getByRole("button", { name: "KC Chiefs won" }).click();
    await expect(page.getByText("Step 2 of 2")).toBeVisible();
    await page.getByRole("button", { name: "Skip this one for now" }).click();

    await expect(page.getByRole("heading", { name: "1 saved, 1 still waiting" })).toBeVisible();
    await expect(page.getByText("No pool needs a decision from you.")).toBeVisible();
    const status = async (id: string) => (await db.query(`select result from games where id = $1`, [id])).rows[0].result as string;
    expect(await status(g1)).toBe("home_win");
    expect(await status(g2)).toBe("pending"); // the skipped one is untouched

    await page.getByRole("link", { name: "Back to your steps" }).click();
    await expect(page.getByRole("heading", { name: "Enter the result still waiting" })).toBeVisible();

    // Leaving part way keeps what was saved.
    await page.getByRole("link", { name: "Start" }).click();
    await page.getByRole("link", { name: "Leave" }).click();
    await page.waitForURL("**/admin/results");
    await expect(page.getByText("Waiting for a result")).toBeVisible();
    await expect(page.getByText("Done 1")).toBeVisible();
    await expect(page.getByText("Not played yet")).toBeVisible();
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("Next step is calm when nothing is waiting, and results for a game not yet played cannot be entered", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const S = nextSeason++;
    const { page } = await newAdmin(browser, db, "calm", "Cal Calm");
    await db.createGame(S, 1, "KC", "BUF", 2);

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "All done for now" })).toBeVisible();
    await expect(page.getByText("Nothing needs you. Results are in and standings are up to date.")).toBeVisible();
    await expect(page.getByText("Picks open")).toBeVisible();
    await expect(page.getByRole("link", { name: /^All admin tools/ })).toBeVisible();

    await page.goto("/admin/results");
    await expect(page.getByText("Not played yet")).toBeVisible();
    await expect(page.getByText(/Kicks off/)).toBeVisible();
    await expect(page.getByRole("button", { name: /won$/ })).toHaveCount(0); // no result buttons for a future game
    await expect(page.getByRole("link", { name: "Do it game by game" })).toHaveCount(0);

    // Phone fit: the buttons and arrows are big enough to tap.
    expect(await noSideways(page)).toBe(true);
    for (const name of ["Previous week", "Next week"]) {
      const box = await page.getByRole("button", { name }).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("correcting a result: Keep changes nothing, changing it re-scores and is recorded, and the warning fits the pools", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const S = nextSeason++;
    const { page, userId } = await newAdmin(browser, db, "fix", "Fran Fixer");
    await db.createPool("Fix Survivor", S);
    const gameId = await db.createGame(S, 1, "KC", "BUF", -0.5);
    await db.decideGame(gameId, "home_win");
    const records = async () => Number((await db.query(`select count(*) from admin_activity where actor_id = $1`, [userId])).rows[0].count);
    const result = async () => (await db.query(`select result from games where id = $1`, [gameId])).rows[0].result as string;

    await page.goto("/admin/results");
    await expect(page.getByText("Chiefs won")).toBeVisible();
    await page.getByRole("button", { name: "Change" }).click();
    await expect(page.getByText("Change this result?")).toBeVisible();
    await expect(page.getByText("you entered Chiefs won")).toBeVisible();
    await expect(page.getByText("Check the roster afterwards")).toBeVisible();
    await expect(page.getByText(/players this result already knocked out are not brought back automatically/)).toBeVisible();
    await expect(page.getByText("Pick 'Em points update by themselves.")).toBeVisible();

    // The current answer cannot be re-picked; Keep it writes nothing.
    await expect(page.getByRole("button", { name: "KC Chiefs won" })).toBeDisabled();
    await page.getByRole("button", { name: "Keep it as it is" }).click();
    await expect(page.getByText("Change this result?")).toHaveCount(0);
    expect(await result()).toBe("home_win");
    expect(await records()).toBe(0);

    // Change it to the other team.
    await page.getByRole("button", { name: "Change" }).click();
    await page.getByRole("button", { name: "BUF Bills won" }).click();
    await expect(page.getByText(/^Bills won .* Final$/)).toBeVisible(); // the row now reads Bills won
    expect(await result()).toBe("away_win");
    expect(await records()).toBe(1);
    const row = (await db.query(`select kind, summary from admin_activity where actor_id = $1`, [userId])).rows[0];
    expect(row.kind).toBe("result_changed");
    expect(row.summary).toBe("Fran Fixer changed a result: Chiefs vs Bills, Bills won.");

    // A season with only pick 'em pools has no survivor sentence.
    const S2 = nextSeason++;
    await db.createPool("Fix PickEm", S2, "pick_em");
    const g2 = await db.createGame(S2, 1, "DAL", "PHI", -0.5);
    await db.decideGame(g2, "home_win");
    await page.goto("/admin/results");
    await page.getByRole("button", { name: "Change" }).click();
    await expect(page.getByText("Pick 'Em points update by themselves.")).toBeVisible();
    await expect(page.getByText(/not brought back automatically/)).toHaveCount(0);
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("a result that would knock out everyone sends the admin to a decision, which keeps the chosen players alive", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const S = nextSeason++;
    const { page, userId } = await newAdmin(browser, db, "wipe", "Wanda Wipe");
    const otherEmail = db.email("wipeother");
    const otherId = await db.createPlayer("wipeother", "Otto Other");
    void otherEmail;
    const poolId = await db.createPool("Wipe Survivor", S);
    const gameId = await db.createGame(S, 1, "KC", "BUF", -0.5); // KC home, BUF away
    const mine = await db.createEntry(poolId, userId);
    const theirs = await db.createEntry(poolId, otherId);
    await db.addPick(mine, 1, "KC");
    await db.addPick(theirs, 1, "KC");
    void gameId;

    // BUF wins, so both KC pickers would be out: nobody left, so the result is held back.
    await page.goto("/admin/results");
    await page.getByRole("button", { name: "BUF Bills won" }).click();
    await expect(page.getByText("Needs your attention.")).toBeVisible();
    const status = async (id: string) => (await db.query(`select status from entries where id = $1`, [id])).rows[0].status as string;
    expect(await status(mine)).toBe("alive"); // nothing applied yet
    expect(await status(theirs)).toBe("alive");

    // The Next step card puts the decision first.
    await page.goto("/admin");
    await expect(page.getByText("Needs your attention", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Everyone would be out" })).toBeVisible();
    await page.getByRole("link", { name: "Resolve it" }).click();

    // The decision screen.
    await expect(page.locator('nav[aria-label="Admin"]')).toHaveCount(0);
    await expect(page.getByText("Nothing has been applied yet.").first()).toBeVisible();
    await expect(page.getByText("You're one of these players. This decision is recorded in Activity and marked as your own entry.")).toBeVisible();
    const rows = page.locator("li", { hasText: "Picked Chiefs, lost" });
    await expect(rows).toHaveCount(2);
    await expect(page.locator("li", { hasText: "Wanda Wipe" })).toContainText("You");
    await expect(page.getByText("0 of 2 will stay in. The other 2 are eliminated in week 1.")).toBeVisible();

    await page.locator("li", { hasText: "Otto Other" }).getByRole("checkbox").check();
    await expect(page.getByText("1 of 2 will stay in. The other 1 is eliminated in week 1.")).toBeVisible();
    await page.getByRole("button", { name: "Keep 1 player alive" }).click();
    await page.waitForURL((url) => url.pathname === "/admin");

    expect(await status(theirs)).toBe("alive");
    expect(await status(mine)).toBe("eliminated");
    await expect(page.getByRole("heading", { name: "Everyone would be out" })).toHaveCount(0);
    const record = (await db.query(`select summary, affects_own_entry from admin_activity where actor_id = $1 and kind = 'wipeout_resolved'`, [userId])).rows[0];
    expect(record.summary).toContain("kept 1 player alive after a wipeout");
    expect(record.affects_own_entry).toBe(true);

    // The decision cannot be made twice.
    await page.goto(`/admin/wipeout/${poolId}/${crypto.randomUUID()}`);
    await expect(page.getByRole("heading", { name: "Nothing to decide" })).toBeVisible();
    await page.context().close();
  } finally {
    await db.close();
  }
});
