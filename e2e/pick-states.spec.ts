import { expect, test, type Browser, type Page } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";
import { apiCall } from "./helpers/api";

// The Pick screen in each of its states, for survivor and pick 'em.

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

test("survivor: used teams are dimmed, a selection is only saved by the confirm bar, and a pick can be changed", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2982;
    const { page, userId } = await newPlayer(browser, db, "sp", "Sam Picker");
    const poolId = await db.createPool("Pick Survivor", SEASON);
    const week1 = await db.createGame(SEASON, 1, "DAL", "PHI", -300); // long past
    await db.decideGame(week1, "home_win");
    await db.createGame(SEASON, 2, "DAL", "SEA", 2);
    await db.createGame(SEASON, 2, "KC", "BUF", 2);
    const entryId = await db.createEntry(poolId, userId);
    await db.addPick(entryId, 1, "DAL");

    await page.goto(pickUrl(poolId, entryId));
    await expect(page.getByRole("heading", { name: "Week 2 pick" })).toBeVisible();
    await expect(page.getByText(/^Locks in /)).toBeVisible();
    await expect(page.getByText("Each team can only be used once all season.")).toBeVisible();
    // Games are grouped under a day heading with a kickoff time.
    await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText(/day$/);
    // Each team has its colour circle (Chiefs red with the code in it).
    const circles = page.getByTestId("team-circle");
    await expect(circles).toHaveCount(4);
    await expect(page.getByRole("button", { name: /^KC/ }).getByTestId("team-circle")).toHaveCSS("background-color", "rgb(198, 12, 48)");

    // DAL was used in week 1: dimmed, labelled and not selectable.
    const dal = page.getByRole("button", { name: /^DAL/ });
    await expect(dal).toBeDisabled();
    await expect(dal).toContainText("Used week 1");

    // Selecting shows the confirm bar but saves nothing.
    await page.getByRole("button", { name: /^KC/ }).click();
    await expect(page.getByRole("button", { name: "Lock in Chiefs" })).toBeVisible();
    await expect(page.getByText(/Chiefs, \w{3} \d{1,2}:\d{2} [AP]M vs Bills/)).toBeVisible();
    expect(await savedTeams(page, entryId, 2)).toEqual([]);

    await page.getByRole("button", { name: "Lock in Chiefs" }).click();
    await expect(page.getByRole("heading", { name: "Locked in" })).toBeVisible();
    await expect(page.getByText("You picked the Chiefs.")).toBeVisible();
    await expect(page.getByText("If they win, you stay alive for week 3.")).toBeVisible();
    expect(await savedTeams(page, entryId, 2)).toEqual(["KC"]);

    // Change it: the new team replaces the old one.
    await page.getByRole("button", { name: "Change my pick" }).click();
    await page.getByRole("button", { name: /^BUF/ }).click();
    await page.getByRole("button", { name: "Lock in Bills" }).click();
    await expect(page.getByText("You picked the Bills.")).toBeVisible();
    expect(await savedTeams(page, entryId, 2)).toEqual(["BUF"]);
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("double-pick week: two teams are needed, and a failed second save says so and keeps the first", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2981;
    const { page, userId } = await newPlayer(browser, db, "dp", "Dana Double");
    const poolId = await db.createPool("Double Pool", SEASON, "survivor", { double_pick_weeks: [1] });
    await db.createGame(SEASON, 1, "KC", "BUF", 2);
    await db.createGame(SEASON, 1, "DAL", "PHI", 2);
    const entryId = await db.createEntry(poolId, userId);

    await page.goto(pickUrl(poolId, entryId));
    await expect(page.getByRole("heading", { name: "Week 1 picks" })).toBeVisible();
    await expect(page.getByText("Choose two teams this week. If either one loses or ties, you're out.")).toBeVisible();

    await page.getByRole("button", { name: /^KC/ }).click();
    await expect(page.getByText("1 of 2 picked. Pick one more team to lock in this week.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Lock in 2 picks" })).toBeDisabled();

    await page.getByRole("button", { name: /^DAL/ }).click();
    const lock = page.getByRole("button", { name: "Lock in 2 picks" });
    await expect(lock).toBeEnabled();

    // Make the second save fail.
    let posts = 0;
    await page.route("**/entries/*/picks", (route) => {
      if (route.request().method() !== "POST") return route.continue();
      posts += 1;
      return posts === 2 ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Boom" }) }) : route.continue();
    });
    await lock.click();
    await expect(page.getByText(/Your pick was not fully saved/)).toBeVisible();
    expect(await savedTeams(page, entryId, 1)).toEqual(["KC"]); // the first one did save, and is shown

    // Try again: only the missing team is sent, and it works.
    await lock.click();
    await expect(page.getByRole("heading", { name: "Locked in" })).toBeVisible();
    expect(await savedTeams(page, entryId, 1)).toEqual(["DAL", "KC"]);
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("pick 'em: tap to pick, change a pick, jump to the next game, and a failed save is not shown as picked", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2980;
    const { page, userId } = await newPlayer(browser, db, "pk", "Pia Picker");
    const poolId = await db.createPool("Tap PickEm", SEASON, "pick_em");
    const games = [
      ["KC", "BUF"],
      ["DAL", "PHI"],
      ["SEA", "SF"],
      ["MIA", "NYJ"],
      ["DET", "GB"],
      ["BAL", "CIN"],
      ["LAR", "ARI"],
      ["DEN", "LV"],
    ] as const;
    for (const [home, away] of games) await db.createGame(SEASON, 1, home, away, 2);
    const entryId = await db.createEntry(poolId, userId);

    await page.goto(pickUrl(poolId, entryId));
    await expect(page.getByRole("heading", { name: "Week 1 picks" })).toBeVisible();
    await expect(page.getByText("0 of 8 picked")).toBeVisible();
    await expect(page.getByText("8 games left to pick")).toBeVisible();

    // Tap to pick: saved immediately.
    await page.getByRole("button", { name: /^KC/ }).click();
    await expect(page.getByRole("button", { name: /^KC/ })).toContainText("Picked");
    await expect(page.getByText("1 of 8 picked")).toBeVisible();
    expect(await savedTeams(page, entryId, 1)).toEqual(["KC"]);

    // Changing a pick replaces it for that game.
    await page.getByRole("button", { name: /^BUF/ }).click();
    await expect(page.getByRole("button", { name: /^BUF/ })).toContainText("Picked");
    await expect(page.getByRole("button", { name: /^KC/ })).not.toContainText("Picked");
    expect(await savedTeams(page, entryId, 1)).toEqual(["BUF"]);
    await expect(page.getByText("1 of 8 picked")).toBeVisible();

    // Jump to next scrolls the first unpicked game into view.
    await page.getByRole("button", { name: "Jump to next" }).click();
    await expect(page.getByRole("button", { name: /^DAL/ })).toBeInViewport();

    // A save that fails is not shown as picked, and says so.
    await page.route("**/entries/*/picks", (route) => (route.request().method() === "POST" ? route.abort() : route.continue()));
    await page.getByRole("button", { name: /^DAL/ }).click();
    await expect(page.getByText(/That pick was not saved/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^DAL/ })).not.toContainText("Picked");
    await page.unroute("**/entries/*/picks");

    // Two quick taps on one game end up with exactly one pick for it.
    const phi = page.getByRole("button", { name: /^PHI/ });
    await phi.click();
    await page.getByRole("button", { name: /^DAL/ }).click({ force: true, timeout: 1000 }).catch(() => undefined);
    await expect(page.getByText(/2 of 8 picked/)).toBeVisible();
    const dallasGame = (await savedTeams(page, entryId, 1)).filter((t) => t === "DAL" || t === "PHI");
    expect(dallasGame).toHaveLength(1);

    // Finish the rest: the screen says all picks are in.
    for (const [home] of games.slice(2)) await page.getByRole("button", { name: new RegExp(`^${home}`) }).click();
    await expect(page.getByText("All picks in")).toBeVisible();
    await expect(page.getByText("8 of 8 picked")).toBeVisible();
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("locked week: survivor and pick 'em show the picks with results and no way to change them", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2979;
    const { page, userId } = await newPlayer(browser, db, "lk", "Lou Locked");
    const survivor = await db.createPool("Locked Survivor", SEASON);
    const pickem = await db.createPool("Locked PickEm", SEASON, "pick_em");
    const g1 = await db.createGame(SEASON, 1, "KC", "BUF", -1);
    const g2 = await db.createGame(SEASON, 1, "DAL", "PHI", 1);
    const sEntry = await db.createEntry(survivor, userId);
    const pEntry = await db.createEntry(pickem, userId);
    await db.setKickoffIn(g1, -3600);
    await db.addPick(sEntry, 1, "KC");
    await db.addPick(pEntry, 1, "KC");
    await db.decideGame(g1, "home_win");
    await db.setPickResult(pEntry, 1, "KC", "win");
    void g2;

    await page.goto(pickUrl(survivor, sEntry));
    await expect(page.getByRole("heading", { name: "Picks are locked" })).toBeVisible();
    await expect(page.getByText("Your pick: the Chiefs. If they win, you stay alive.")).toBeVisible();
    await expect(page.getByText("Picks can't be changed once the week's first game has started.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^(KC|BUF|DAL|PHI)/ })).toBeDisabled({ timeout: 2000 }).catch(() => undefined);
    for (const name of ["Lock in", "Change my pick"]) await expect(page.getByRole("button", { name: new RegExp(name) })).toHaveCount(0);

    await page.goto(pickUrl(pickem, pEntry));
    await expect(page.getByRole("heading", { name: "Picks are locked" })).toBeVisible();
    await expect(page.getByText("This week: 1 correct so far")).toBeVisible();
    await expect(page.getByText(/Your pick · Correct/)).toBeVisible();
    await expect(page.getByText("Final", { exact: true })).toBeVisible();
    await expect(page.getByText(/Waiting for result · No pick made/)).toBeVisible();
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("an eliminated entry sees its season, with each pick's result and the Pick 'Em offer", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2978;
    const { page, userId } = await newPlayer(browser, db, "el", "Eli Out");
    const survivor = await db.createPool("Out Survivor", SEASON);
    const pickem = await db.createPool("Out PickEm", SEASON, "pick_em");
    const pickemName = (await db.query(`select name from pools where id = $1`, [pickem])).rows[0].name as string;
    await db.createGame(SEASON, 4, "KC", "BUF", 2);
    const entryId = await db.createEntry(survivor, userId);
    await db.addPick(entryId, 1, "SEA");
    await db.addPick(entryId, 2, "DAL");
    await db.addPick(entryId, 3, "MIA");
    await db.setPickResult(entryId, 1, "SEA", "win");
    await db.setPickResult(entryId, 2, "DAL", "win");
    await db.setPickResult(entryId, 3, "MIA", "loss");
    await db.eliminate(entryId, 3);

    await page.goto(pickUrl(survivor, entryId));
    await expect(page.getByRole("heading", { name: "Your season" })).toBeVisible();
    await expect(page.getByText("Eliminated in week 3")).toBeVisible();
    await expect(page.getByText("You're out of this one. Picks are done for you, but you can keep following along.")).toBeVisible();
    await expect(page.locator("li", { hasText: "Week 1" })).toContainText("Correct");
    await expect(page.locator("li", { hasText: "Week 2" })).toContainText("Correct");
    await expect(page.locator("li", { hasText: "Week 3" })).toContainText("Wrong");
    await expect(page.getByRole("link", { name: "See standings" })).toHaveAttribute("href", `/pool/${survivor}`);
    await expect(page.getByRole("link", { name: `Join ${pickemName}` })).toHaveAttribute("href", `/join/${pickem}`);
    await expect(page.getByRole("button", { name: /^(KC|BUF)/ })).toHaveCount(0);
    await page.context().close();
  } finally {
    await db.close();
  }
});

test("the server refuses a pick for a team that is not playing that week", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2977;
    const { page, userId } = await newPlayer(browser, db, "bye", "Bea Bye");
    const poolId = await db.createPool("Bye Pool", SEASON);
    await db.createGame(SEASON, 1, "KC", "BUF", 2);
    const entryId = await db.createEntry(poolId, userId);
    await page.goto("/");
    const res = await apiCall(page, "POST", `/entries/${entryId}/picks`, { week_number: 1, team_code: "MIA" });
    expect(res.status).toBe(400);
    expect(await savedTeams(page, entryId, 1)).toEqual([]);
    await page.context().close();
  } finally {
    await db.close();
  }
});
