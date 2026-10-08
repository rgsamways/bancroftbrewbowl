import { expect, test } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

// The standings page lists who is still alive and who is out, and links the player's own entry.

const SEASON = 2994;

test("standings show alive and eliminated players, with the player's own name as the only link", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const mine = db.email("me");
    const page = await signIn(browser, db, mine);
    const theirs = db.email("them");
    const out = db.email("out");
    const other = await signIn(browser, db, theirs);
    const gone = await signIn(browser, db, out);
    const ids = {
      mine: await db.setUser(mine, "Alive Me"),
      theirs: await db.setUser(theirs, "Alive Them"),
      out: await db.setUser(out, "Gone Gary"),
    };
    const poolId = await db.createPool("Standings Pool", SEASON);
    const poolName = (await db.query(`select name from pools where id = $1`, [poolId])).rows[0].name as string;
    await db.createGame(SEASON, 1, "KC", "BUF");
    await db.createEntry(poolId, ids.mine);
    await db.createEntry(poolId, ids.theirs);
    const goneEntry = await db.createEntry(poolId, ids.out, "eliminated");
    await db.query(`update entries set eliminated_week = 1 where id = $1`, [goneEntry]);

    await page.goto(`/pool/${poolId}`);
    await expect(page.getByText(poolName, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "You're still alive" })).toBeVisible();
    await expect(page.getByText("2 of 3 still alive")).toBeVisible();
    await expect(page.getByText("Still alive 2")).toBeVisible();
    await expect(page.getByText("Eliminated 1")).toBeVisible();
    await expect(page.getByText("Alive Them")).toBeVisible();
    await expect(page.getByText("Gone Gary")).toBeVisible();
    await expect(page.getByText("Out in week 1")).toBeVisible();
    await expect(page.getByText("Please drink responsibly.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Show on TV" })).toHaveAttribute("href", `/pool/${poolId}/tv`);

    const links = await page.$$eval('main a[href*="/entry/"]:not(nav[aria-label="Pool screens"] a)', (as) => as.map((a) => a.textContent!.trim()));
    expect(links).toHaveLength(1);
    expect(links[0]).toContain("Alive Me");
    expect(links[0]).toContain("You");

    await other.context().close();
    await gone.context().close();
    await page.context().close();
  } finally {
    await db.close();
  }
});
