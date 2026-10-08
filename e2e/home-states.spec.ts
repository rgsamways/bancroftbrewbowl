import { expect, test, type Browser, type Page } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

// Home: the hero for each state of an entry, the pool switcher, and the server-clock countdown.
// Each test makes its own player, so states never leak between tests.

async function newPlayer(browser: Browser, db: TestDb, label: string, name: string) {
  const email = db.email(label);
  const page = await signIn(browser, db, email);
  const userId = await db.setUser(email, name);
  return { page, userId };
}

const home = async (page: Page) => {
  await page.goto("/");
  await page.waitForSelector("header");
};

test("survivor Home walks through not picked, picked, locked, out and season over", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2989;
    const { page, userId } = await newPlayer(browser, db, "surv", "Sue Survivor");
    const poolId = await db.createPool("Home Survivor", SEASON);
    const poolName = (await db.query(`select name from pools where id = $1`, [poolId])).rows[0].name as string;
    const gameId = await db.createGame(SEASON, 1, "KC", "BUF", 2);
    const entryId = await db.createEntry(poolId, userId);

    // Not picked: the headline, the week, the pool line, a countdown and the main button.
    await home(page);
    await expect(page.getByRole("heading", { name: "You're still alive" })).toBeVisible();
    await expect(page.getByText("Week 1: make your pick")).toBeVisible();
    await expect(page.getByText(`${poolName} · 1 player`)).toBeVisible();
    await expect(page.getByText(/^Locks in (1d 23h|2d 0h)/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Make my pick" })).toHaveAttribute("href", `/pool/${poolId}/entry/${entryId}/pick`);
    await expect(page.getByText("Please drink responsibly.")).toBeVisible();
    // Lives, retired offers and prize wording never appear.
    await expect(page.getByText(/mulligan|lives|reward|prize/i)).toHaveCount(0);

    // Picked.
    await db.addPick(entryId, 1, "KC");
    await home(page);
    await expect(page.getByRole("heading", { name: "Locked in" })).toBeVisible();
    await expect(page.getByText("Week 1: you're all set")).toBeVisible();
    await expect(page.getByRole("link", { name: "Change my pick" })).toBeVisible();

    // Locked: the first kickoff has passed but the game is still undecided.
    await db.setKickoffIn(gameId, -3600);
    await home(page);
    await expect(page.getByRole("heading", { name: "Picks are locked" })).toBeVisible();
    await expect(page.getByText("Games are underway")).toBeVisible();
    await expect(page.getByText(/^Locks in/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "See standings" })).toHaveAttribute("href", `/pool/${poolId}`);

    // Out.
    await db.eliminate(entryId, 1);
    await home(page);
    await expect(page.getByRole("heading", { name: "You're out" })).toBeVisible();
    await expect(page.getByText(`${poolName} · you went out in week 1`)).toBeVisible();
    await expect(page.getByText(/mulligan|lives/i)).toHaveCount(0);

    // Season over: every game decided, and this player is the last one standing.
    await db.query(`update entries set status = 'alive', eliminated_week = null where id = $1`, [entryId]);
    await db.decideGame(gameId, "home_win");
    await home(page);
    await expect(page.getByRole("heading", { name: `${SEASON} season complete` })).toBeVisible();
    await expect(page.getByText("That's a wrap")).toBeVisible();
    await expect(page.getByText(`${poolName} champion: Sue Survivor`)).toBeVisible();

    await page.context().close();
  } finally {
    await db.close();
  }
});

test("an eliminated survivor player is offered an open Pick 'Em pool", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2988;
    const { page, userId } = await newPlayer(browser, db, "offer", "Olive Offer");
    const poolId = await db.createPool("Offer Survivor", SEASON);
    const pickEmId = await db.createPool("Offer PickEm", SEASON, "pick_em");
    const pickEmName = (await db.query(`select name from pools where id = $1`, [pickEmId])).rows[0].name as string;
    await db.createGame(SEASON, 1, "KC", "BUF", 2);
    const entryId = await db.createEntry(poolId, userId);
    await db.eliminate(entryId, 1);

    await home(page);
    await expect(page.getByRole("heading", { name: "You're out" })).toBeVisible();
    await expect(page.getByText("Still want in on the action?")).toBeVisible();
    await expect(page.getByRole("link", { name: `Join ${pickEmName}` }).first()).toHaveAttribute("href", `/join/${pickEmId}`);
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("pick 'em Home: picks to make, progress, all picked, locked", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2987;
    const { page, userId } = await newPlayer(browser, db, "pe", "Pat Pickem");
    const poolId = await db.createPool("Home PickEm", SEASON, "pick_em");
    const poolName = (await db.query(`select name from pools where id = $1`, [poolId])).rows[0].name as string;
    const g1 = await db.createGame(SEASON, 1, "KC", "BUF", 2);
    await db.createGame(SEASON, 1, "DAL", "PHI", 2);
    const entryId = await db.createEntry(poolId, userId);

    await home(page);
    await expect(page.getByText("Week 1: make your picks")).toBeVisible();
    await expect(page.getByText("0 of 2 picked")).toBeVisible();
    await expect(page.getByText("Your points 0")).toBeVisible();
    await expect(page.getByRole("link", { name: "Make my picks" })).toBeVisible();
    // Alone in the pool and no points yet: tied for first with nobody, shown as 1st of 1.
    await expect(page.getByRole("heading", { name: "1st of 1" })).toBeVisible();

    await db.addPick(entryId, 1, "KC");
    await home(page);
    await expect(page.getByText("1 of 2 picked")).toBeVisible();
    await expect(page.getByRole("link", { name: "Finish my picks" })).toBeVisible();

    await db.addPick(entryId, 1, "DAL");
    await home(page);
    await expect(page.getByRole("heading", { name: "All picks in" })).toBeVisible();
    await expect(page.getByText("Week 1: you're all set")).toBeVisible();
    await expect(page.getByRole("link", { name: "Review or change my picks" })).toBeVisible();

    await db.setKickoffIn(g1, -3600);
    await db.setPickResult(entryId, 1, "KC", "win");
    await db.decideGame(g1, "home_win");
    await home(page);
    await expect(page.getByRole("heading", { name: "Picks are locked" })).toBeVisible();
    await expect(page.getByText("Your points 1")).toBeVisible();
    await expect(page.getByText("This week: 1 correct so far")).toBeVisible();
    await expect(page.getByRole("link", { name: "See my picks" })).toBeVisible();
    await expect(page.getByText(poolName).first()).toBeVisible();
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("in two pools Home opens on the one that needs a pick, and the switcher changes the hero", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2986;
    const { page, userId } = await newPlayer(browser, db, "two", "Tess Two");
    const picked = await db.createPool("Chip Picked", SEASON);
    const needs = await db.createPool("Chip Needs", SEASON);
    const pickedName = (await db.query(`select name from pools where id = $1`, [picked])).rows[0].name as string;
    const needsName = (await db.query(`select name from pools where id = $1`, [needs])).rows[0].name as string;
    await db.createGame(SEASON, 1, "KC", "BUF", 2);
    const pickedEntry = await db.createEntry(picked, userId); // joined first
    await db.createEntry(needs, userId);
    await db.addPick(pickedEntry, 1, "KC");

    await home(page);
    // The pool needing a pick leads, although it was joined second.
    await expect(page.getByRole("heading", { name: "You're still alive" })).toBeVisible();
    const switcher = page.getByRole("button", { name: needsName, exact: true });
    await expect(switcher).toHaveAttribute("aria-expanded", "false");
    await switcher.click();
    const list = page.getByRole("list", { name: "Your pools" });
    await expect(list.getByRole("button", { name: new RegExp(needsName) })).toHaveAttribute("aria-current", "true");
    await expect(list.getByRole("button", { name: new RegExp(pickedName) })).not.toHaveAttribute("aria-current", "true");
    await expect(list.getByText("Pick made")).toBeVisible();

    await list.getByRole("button", { name: new RegExp(pickedName) }).click();
    await expect(list).toHaveCount(0); // choosing closes it
    await expect(page.getByRole("heading", { name: "Locked in" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Locked in" })).toBeVisible(); // the choice is remembered
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("the countdown follows the server's clock, not the phone's", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2985;
    const email = db.email("skew");
    const page = await signIn(browser, db, email);
    const userId = await db.setUser(email, "Skew Player");
    const poolId = await db.createPool("Skew Pool", SEASON);
    await db.createGame(SEASON, 1, "KC", "BUF", 3);
    await db.createEntry(poolId, userId);
    // The phone thinks it is 2020: a countdown from the phone's clock would be years long.
    await page.clock.install({ time: new Date("2020-01-01T12:00:00Z") });
    await page.goto("/");
    await expect(page.getByText(/^Locks in (2d 23h|3d 0h)/)).toBeVisible();
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("when the countdown reaches zero Home switches to locked without a reload", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2984;
    const { page, userId } = await newPlayer(browser, db, "zero", "Zed Zero");
    const poolId = await db.createPool("Zero Pool", SEASON);
    const gameId = await db.createGame(SEASON, 1, "KC", "BUF", 2);
    await db.createEntry(poolId, userId);
    await db.setKickoffIn(gameId, 9);

    await home(page);
    await expect(page.getByText("Locks in less than a minute")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Picks are locked" })).toBeVisible({ timeout: 20_000 });
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("a finished pool cannot be joined", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2983;
    const { page } = await newPlayer(browser, db, "closed", "Cleo Closed");
    const poolId = await db.createPool("Closed Pool", SEASON);
    const poolName = (await db.query(`select name from pools where id = $1`, [poolId])).rows[0].name as string;
    await db.query(`update pools set status = 'completed' where id = $1`, [poolId]);

    await page.goto(`/join/${poolId}`);
    await expect(page.getByText(`${poolName} has finished, so it isn't taking new players.`)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Join/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "See final standings" })).toHaveAttribute("href", `/pool/${poolId}`);
    await page.context().close();
  } finally {
    await db.close();
  }
});
