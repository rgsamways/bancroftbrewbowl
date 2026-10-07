import { expect, test, type Page } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

// Standings > Week by week: a grid of who picked what, through the same privacy test as the Pick screen.

const PER_GAME = { pick_deadline_rule: "per_game_kickoff" };

async function viewer(browser: Parameters<typeof signIn>[0], db: TestDb, label: string, name: string) {
  const email = db.email(label);
  const page = await signIn(browser, db, email);
  const userId = await db.setUser(email, name);
  return { page, userId };
}

const cellsOf = (page: Page, name: string) => page.getByTestId("grid-row").filter({ hasText: name }).getByTestId("grid-cell");

test("survivor: another player's pick shows only once its game has started; mine always shows; the switch is in the address", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2958;
    const { page, userId } = await viewer(browser, db, "grid", "Grid Gary");
    const poolId = await db.createPool("Grid Survivor", SEASON, "survivor", PER_GAME);
    const started = await db.createGame(SEASON, 1, "BUF", "KC");
    const later = await db.createGame(SEASON, 1, "DET", "NYJ");
    await db.setKickoffIn(started, -7200);
    await db.setKickoffIn(later, 24 * 3600);
    const mine = await db.createEntry(poolId, userId);
    const ann = await db.createEntry(poolId, await db.createPlayer("ann", "Ann Alive"));
    const bob = await db.createEntry(poolId, await db.createPlayer("bob", "Bob Open"));
    await db.addPick(mine, 1, "NYJ");
    await db.addPick(ann, 1, "KC");
    await db.addPick(bob, 1, "DET");
    await db.setPickResult(ann, 1, "KC", "win");

    await page.goto(`/pool/${poolId}`);
    await expect(page.getByRole("button", { name: "Standings", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Week by week" }).click();
    await expect(page).toHaveURL(/view=weeks/);
    await expect(page.getByRole("button", { name: "Week by week" })).toHaveAttribute("aria-pressed", "true");

    const grid = page.getByTestId("pick-grid");
    await expect(grid.getByRole("columnheader", { name: "W1" })).toBeVisible();
    // My row is highlighted with "You" (not pinned), with my own pick (not yet started) showing.
    await expect(page.getByTestId("grid-row").filter({ hasText: "Grid Gary" })).toContainText("You");
    await expect(cellsOf(page, "Grid Gary").first()).toHaveAttribute("aria-label", /Jets, still to play/);
    // Ann's pick is for a game that has started, so it shows, with a result; Bob's has not, so it is blank.
    await expect(cellsOf(page, "Ann Alive").first()).toHaveAttribute("aria-label", /Chiefs, won/);
    await expect(cellsOf(page, "Bob Open").first()).toHaveAttribute("data-kind", "empty");
    expect(await grid.innerText()).not.toContain("Lions");
    await expect(page.getByText("You've used 1 of 32 teams, so 31 are left.")).toBeVisible();
    await expect(grid.getByText("Most picked")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // Bob's game starts: his pick appears on the next look.
    await db.setKickoffIn(later, -60);
    await page.reload();
    await expect(cellsOf(page, "Bob Open").first()).toHaveAttribute("aria-label", /Lions, still to play/);

    // Back to the lists.
    await page.getByRole("button", { name: "Standings", exact: true }).click();
    await expect(page).not.toHaveURL(/view=weeks/);
    await expect(page.getByText("Still alive 3")).toBeVisible();

    await page.context().close();
  } finally {
    await db.close();
  }
});

test("pick 'em: points per week, a total and a rank", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2957;
    const { page, userId } = await viewer(browser, db, "gridpe", "Pam Picker");
    const poolId = await db.createPool("Grid Pick Em", SEASON, "pick_em", PER_GAME);
    const g1 = await db.createGame(SEASON, 1, "BUF", "KC");
    const g2 = await db.createGame(SEASON, 1, "DET", "NYJ");
    await db.setKickoffIn(g1, -7200);
    await db.setKickoffIn(g2, -3600);
    await db.decideGame(g1, "home_win");
    await db.decideGame(g2, "away_win");
    const mine = await db.createEntry(poolId, userId);
    const rival = await db.createEntry(poolId, await db.createPlayer("rival", "Rick Rival"));
    for (const [entry, team, result] of [
      [mine, "BUF", "win"],
      [mine, "NYJ", "win"],
      [rival, "BUF", "win"],
      [rival, "DET", "loss"],
    ] as const) {
      await db.addPick(entry, 1, team);
      await db.setPickResult(entry, 1, team, result);
    }

    await page.goto(`/pool/${poolId}?view=weeks`);
    const rows = page.getByTestId("grid-row");
    await expect(rows.first()).toContainText("Pam Picker"); // 2 points puts her first, by total, not because she is the viewer
    await expect(cellsOf(page, "Pam Picker").first()).toHaveText("2");
    await expect(cellsOf(page, "Rick Rival").first()).toHaveText("1");
    await expect(rows.first()).toContainText("1"); // rank
    await expect(page.getByText(/Each number is how many picks that player got right/)).toBeVisible();
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("a late start: weeks nobody picked in are columns marked as a free pass, with a note", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2956;
    const { page, userId } = await viewer(browser, db, "gridlate", "Late Larry");
    const poolId = await db.createPool("Grid Late", SEASON, "survivor", PER_GAME);
    for (const [week, home, away] of [[1, "KC", "BUF"], [2, "DET", "NYJ"]] as const) {
      const g = await db.createGame(SEASON, week, home, away);
      await db.setKickoffIn(g, -(10 - week) * 86400);
      await db.decideGame(g, "home_win");
    }
    const current = await db.createGame(SEASON, 3, "PHI", "DAL", 2);
    void current;
    const mine = await db.createEntry(poolId, userId);
    await db.addPick(mine, 3, "PHI");

    await page.goto(`/pool/${poolId}?view=weeks`);
    const grid = page.getByTestId("pick-grid");
    await expect(grid.getByRole("columnheader", { name: "W3" })).toBeVisible();
    for (const w of ["W1", "W2"]) await expect(grid.getByRole("columnheader", { name: w })).toBeVisible();
    await expect(cellsOf(page, "Late Larry").nth(0)).toHaveAttribute("data-kind", "free_pass");
    await expect(cellsOf(page, "Late Larry").nth(1)).toHaveAttribute("data-kind", "free_pass");
    await expect(cellsOf(page, "Late Larry").nth(2)).toHaveAttribute("data-kind", "picks");
    await expect(page.getByTestId("grid-free-pass")).toHaveText("No picks were made in weeks 1 and 2 (the pool started late), so everyone got a free pass.");
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("a pool with no picks says there is nothing to show yet", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2955;
    const { page, userId } = await viewer(browser, db, "gridnone", "Nobody Ned");
    const poolId = await db.createPool("Grid Empty", SEASON);
    await db.createGame(SEASON, 1, "KC", "BUF", 2);
    await db.createEntry(poolId, userId);
    await page.goto(`/pool/${poolId}?view=weeks`);
    await expect(page.getByText("Nothing to show yet")).toBeVisible();
    await page.context().close();
  } finally {
    await db.close();
  }
});
