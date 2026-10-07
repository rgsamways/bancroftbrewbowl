import { expect, test } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";
import { ESPN_STUB_URL } from "./env";

// The NFL scoreboard on Home, read from ESPN (a local stand-in here) through one cached feed.

const setEspn = (state: object) =>
  fetch(`${ESPN_STUB_URL}/__set`, { method: "POST", body: JSON.stringify(state) }).then((r) => {
    if (!r.ok) throw new Error("could not set the ESPN stand-in");
  });

// Leave the stand-in empty for the next test file (Home reads it for the scoreboard).
test.afterEach(() => setEspn({ mode: "ok", games: [] }));

const day = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

const GAMES = [
  { week: 1, home: "PHI", away: "DAL", state: "post", final: true, homeScore: 24, awayScore: 20, detail: "Final", homeRecord: "4-0", awayRecord: "1-3", network: "FOX", date: day(-0.2) },
  { week: 1, home: "BUF", away: "KC", state: "in", homeScore: 17, awayScore: 21, detail: "Q3 4:21", homeRecord: "3-1", awayRecord: "3-1", network: "CBS", date: day(-0.1) },
  { week: 1, home: "DET", away: "NYJ", date: day(1), homeRecord: "2-2", awayRecord: "1-3", network: "ESPN" },
  { week: 1, home: "MIA", away: "NE", date: day(1.1) },
  { week: 1, home: "SF", away: "SEA", date: day(1.2) },
  { week: 1, home: "GB", away: "CHI", date: day(1.3) },
  { week: 1, home: "LAR", away: "ARI", date: day(1.4) },
  { week: 1, home: "BAL", away: "CIN", date: day(1.5) },
];

test("Home shows the scoreboard: live first, own pick marked, byes, show all, and a refresh updates the score", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2961;
    const email = db.email("sb");
    const page = await signIn(browser, db, email);
    const userId = await db.setUser(email, "Score Watcher");
    const poolId = await db.createPool("Scoreboard Pool", SEASON);
    const g = await db.createGame(SEASON, 1, "BUF", "KC", 2);
    await db.createGame(SEASON, 1, "DET", "NYJ", 2);
    const entry = await db.createEntry(poolId, userId);
    await db.addPick(entry, 1, "KC");
    void g;

    await setEspn({ mode: "ok", byes: { "1": ["CAR"] }, games: GAMES });
    await page.clock.install({ time: new Date() });
    await page.goto("/");

    const section = page.getByRole("region", { name: "NFL scoreboard" });
    await expect(section.getByRole("heading", { name: /NFL scoreboard . Week 1/ })).toBeVisible();

    // Six rows to start, the live game first, then what is coming, then the final.
    const rows = section.getByTestId("scoreboard-game");
    await expect(rows).toHaveCount(6);
    await expect(rows.first()).toHaveAttribute("data-state", "live");
    await expect(rows.first()).toContainText("Q3 4:21");
    await expect(rows.first()).toContainText("CBS");
    await expect(rows.first().getByTestId("scoreboard-score")).toHaveText(["21", "17"]);
    await expect(rows.first()).toContainText("3-1");
    // Only my own pick is marked.
    await expect(section.getByText("Your pick")).toHaveCount(1);
    await expect(rows.first().getByText("Your pick")).toBeVisible();
    await expect(rows.nth(1)).toHaveAttribute("data-state", "upcoming");

    await section.getByRole("button", { name: "Show all 8 games" }).click();
    await expect(rows).toHaveCount(8);
    await expect(rows.last()).toHaveAttribute("data-state", "final");
    await expect(rows.last()).toContainText("Final");
    await expect(section.getByText("On a bye: Panthers")).toBeVisible();
    await expect(section.getByText(/Updated .*Scores can lag a little/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // A game goes on: the next refresh (about 30 seconds while a game is live) shows the new score.
    await setEspn({
      mode: "ok",
      byes: { "1": ["CAR"] },
      games: GAMES.map((game) => (game.home === "BUF" ? { ...game, homeScore: 17, awayScore: 28, detail: "Q4 9:58" } : game)),
    });
    await page.clock.fastForward(31_000);
    await expect(rows.first()).toContainText("Q4 9:58");
    await expect(rows.first().getByTestId("scoreboard-score")).toHaveText(["28", "17"]);

    await page.context().close();
  } finally {
    await db.close();
  }
});

test("when ESPN is down Home carries on without a scoreboard and without an error", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2960;
    const email = db.email("sbdown");
    const page = await signIn(browser, db, email);
    const userId = await db.setUser(email, "No Scores Nell");
    const poolId = await db.createPool("Scoreboard Down Pool", SEASON);
    await db.createGame(SEASON, 1, "KC", "BUF", 2);
    await db.createEntry(poolId, userId);

    await setEspn({ mode: "down", games: [] });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await page.waitForTimeout(600);
    await expect(page.getByRole("region", { name: "NFL scoreboard" })).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);

    await page.context().close();
  } finally {
    await db.close();
  }
});
