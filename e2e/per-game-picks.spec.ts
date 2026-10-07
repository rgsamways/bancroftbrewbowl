import { expect, test, type Browser, type Page } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";
import { apiCall } from "./helpers/api";

// A pool that locks each pick at its own game's kickoff: the week's first game has started, but
// the later games can still be picked and changed, and only a started game is closed.

async function newPlayer(browser: Browser, db: TestDb, label: string, name: string) {
  const email = db.email(label);
  const page = await signIn(browser, db, email);
  const userId = await db.setUser(email, name);
  return { page, userId };
}

const pickUrl = (poolId: string, entryId: string) => `/pool/${poolId}/entry/${entryId}/pick`;
const savedTeams = async (page: Page, entryId: string, week: number) => {
  const res = await apiCall<{ weekNumber: number; teamCode: string }[]>(page, "GET", `/entries/${entryId}/picks`);
  return res.json!.filter((p) => p.weekNumber === week).map((p) => p.teamCode).sort();
};

const PER_GAME = { pick_deadline_rule: "per_game_kickoff" };

// Week 1: KC at BUF started two hours ago, DET at NYJ in a day, PHI at DAL in two days.
async function weekWithOneStarted(db: TestDb, season: number) {
  const started = await db.createGame(season, 1, "BUF", "KC");
  const lions = await db.createGame(season, 1, "DET", "NYJ");
  const eagles = await db.createGame(season, 1, "PHI", "DAL");
  await db.setKickoffIn(started, -7200);
  await db.setKickoffIn(lions, 24 * 3600);
  await db.setKickoffIn(eagles, 48 * 3600);
  return { started, lions, eagles };
}

test("survivor: a later game can be picked and changed after the first game has started; a started pick is locked", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2966;
    const { page, userId } = await newPlayer(browser, db, "pg", "Per Game Pat");
    const poolId = await db.createPool("Per Game Survivor", SEASON, "survivor", PER_GAME);
    const games = await weekWithOneStarted(db, SEASON);
    const entryId = await db.createEntry(poolId, userId);

    await page.goto(pickUrl(poolId, entryId));
    await expect(page.getByRole("heading", { name: "Week 1 pick" })).toBeVisible();
    await expect(page.getByText("Each game locks when it kicks off.")).toBeVisible();
    await expect(page.getByText(/^Next game locks in /)).toBeVisible();
    // The started game is shown and closed; the later ones are open.
    await expect(page.getByText(/· Started$/)).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^KC/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: /^KC/ })).toContainText("Started");
    await expect(page.getByRole("button", { name: /^DET/ })).toBeEnabled();

    // Pick Detroit, then change to Philadelphia: both games are still open.
    await page.getByRole("button", { name: /^DET/ }).click();
    await page.getByRole("button", { name: "Lock in Lions" }).click();
    await expect(page.getByRole("heading", { name: "Locked in" })).toBeVisible();
    await expect(page.getByText(/^Your pick locks in /)).toBeVisible();
    expect(await savedTeams(page, entryId, 1)).toEqual(["DET"]);
    await page.getByRole("button", { name: "Change my pick" }).click();
    await page.getByRole("button", { name: /^PHI/ }).click();
    await page.getByRole("button", { name: "Lock in Eagles" }).click();
    await expect(page.getByText("You picked the Eagles.")).toBeVisible();
    expect(await savedTeams(page, entryId, 1)).toEqual(["PHI"]);

    // Home shows the pick as in, counting down to that pick's own game.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Locked in" })).toBeVisible();
    await expect(page.getByText(/^Your pick locks in /)).toBeVisible();

    // The Eagles game starts: the pick is locked, the change button is gone, and the server refuses a swap.
    await db.setKickoffIn(games.eagles, -60);
    await page.goto(pickUrl(poolId, entryId));
    await expect(page.getByRole("heading", { name: "Picks are locked" })).toBeVisible();
    await expect(page.getByText("Your pick is locked because its game has started.")).toBeVisible();
    const swap = await apiCall(page, "POST", `/entries/${entryId}/picks`, { week_number: 1, team_code: "DET" });
    expect(swap.status).toBe(409);
    expect(await savedTeams(page, entryId, 1)).toEqual(["PHI"]);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Picks are locked" })).toBeVisible();

    await page.context().close();
  } finally {
    await db.close();
  }
});

test("pick 'em: started games are closed, the rest can be picked and changed", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2965;
    const { page, userId } = await newPlayer(browser, db, "pgpe", "Per Game Pam");
    const poolId = await db.createPool("Per Game Pick Em", SEASON, "pick_em", PER_GAME);
    await weekWithOneStarted(db, SEASON);
    const entryId = await db.createEntry(poolId, userId);

    await page.goto(pickUrl(poolId, entryId));
    await expect(page.getByRole("heading", { name: "Week 1 picks" })).toBeVisible();
    await expect(page.getByText("0 of 3 picked")).toBeVisible();
    await expect(page.getByText("2 games left to pick")).toBeVisible(); // the started game is not counted
    await expect(page.getByRole("button", { name: /^BUF/ })).toBeDisabled();
    await expect(page.getByRole("button", { name: /^KC/ })).toBeDisabled();

    await page.getByRole("button", { name: /^DET/ }).click();
    await expect(page.getByText("1 of 3 picked")).toBeVisible();
    await page.getByRole("button", { name: /^NYJ/ }).click(); // change within the same game
    await expect.poll(() => savedTeams(page, entryId, 1)).toEqual(["NYJ"]);
    await page.getByRole("button", { name: /^PHI/ }).click();
    await expect.poll(() => savedTeams(page, entryId, 1)).toEqual(["NYJ", "PHI"]);
    await expect(page.getByText("All picks in")).toBeVisible();

    // Home: picked (the started game does not need a pick).
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "All picks in" })).toBeVisible();

    // A pick cannot be added for the started game, and the server says so.
    const late = await apiCall(page, "POST", `/entries/${entryId}/picks`, { week_number: 1, team_code: "KC" });
    expect(late.status).toBe(409);

    await page.context().close();
  } finally {
    await db.close();
  }
});

test("a whole-week pool still locks everything at the week's first kickoff", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2964;
    const { page, userId } = await newPlayer(browser, db, "pgw", "Whole Week Will");
    const poolId = await db.createPool("Whole Week Survivor", SEASON);
    await weekWithOneStarted(db, SEASON);
    const entryId = await db.createEntry(poolId, userId);

    await page.goto(pickUrl(poolId, entryId));
    await expect(page.getByRole("heading", { name: "Picks are locked" })).toBeVisible();
    const res = await apiCall(page, "POST", `/entries/${entryId}/picks`, { week_number: 1, team_code: "DET" });
    expect(res.status).toBe(409);

    await page.context().close();
  } finally {
    await db.close();
  }
});
