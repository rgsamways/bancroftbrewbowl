import { expect, test, type Page } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";
import { apiCall } from "./helpers/api";

// An admin enters a game result on the Schedule page; the entry that picked the loser is
// eliminated and shows up that way in the standings. A player cannot enter results.
// The results screen is driven through the page itself (no test-only back door).

const SEASON = 2995;

test.describe.configure({ mode: "serial" });

const db = new TestDb();
let admin: Page;
let player: Page;
let poolId = "";
let gameId = "";
let loserEntry = "";
let winnerEntry = "";

test.beforeAll(async ({ browser }) => {
  await db.connect();
  const adminEmail = db.email("admin");
  const loserEmail = db.email("loser");
  const winnerEmail = db.email("winner");
  admin = await signIn(browser, db, adminEmail);
  player = await signIn(browser, db, loserEmail);
  const third = await signIn(browser, db, winnerEmail);
  await third.context().close();
  await db.setUser(adminEmail, "Result Admin", true);
  const loserId = await db.setUser(loserEmail, "Picks Home");
  const winnerId = await db.setUser(winnerEmail, "Picks Away");

  poolId = await db.createPool("Results Pool", SEASON);
  gameId = await db.createGame(SEASON, 1, "KC", "BUF", -1); // kicked off yesterday
  loserEntry = await db.createEntry(poolId, loserId);
  winnerEntry = await db.createEntry(poolId, winnerId);
  await db.addPick(loserEntry, 1, "KC"); // home team
  await db.addPick(winnerEntry, 1, "BUF"); // away team
});

test.afterAll(async () => {
  await db.close();
});

test("a player cannot enter a result (403) and the game stays pending", async () => {
  const attempt = await apiCall(player, "POST", `/nfl/games/${gameId}/result`, { result: "away_win" });
  expect(attempt.status).toBe(403);
  const row = (await db.query(`select result from games where id = $1`, [gameId])).rows[0];
  expect(row.result).toBe("pending");
});

test("an admin enters the away team as the winner on the Schedule page", async () => {
  await admin.goto("/admin/schedule");
  await admin.getByLabel("Season").selectOption(String(SEASON));
  await expect(admin.getByText("BUF @ KC")).toBeVisible();
  await admin.getByRole("button", { name: "BUF won" }).click();
  await expect(admin.getByRole("button", { name: "KC lost" })).toBeVisible();
  const row = (await db.query(`select result from games where id = $1`, [gameId])).rows[0];
  expect(row.result).toBe("away_win");
});

test("the entry that picked the loser is eliminated and the other stays alive", async () => {
  const status = async (id: string) => (await db.query(`select status from entries where id = $1`, [id])).rows[0].status;
  expect(await status(loserEntry)).toBe("eliminated");
  expect(await status(winnerEntry)).toBe("alive");

  await player.goto(`/pool/${poolId}`);
  await expect(player.getByText("Still alive (1)")).toBeVisible();
  await expect(player.getByText("Eliminated (1)")).toBeVisible();
});
