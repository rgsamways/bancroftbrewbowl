import { expect, test } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";
import { apiCall } from "./helpers/api";
import { ESPN_STUB_URL } from "./env";

// "Check for results": the admin Results screen asks ESPN (a local stand-in here) what has finished,
// shows it, and saves and scores it only on Apply.

const SEASON = 2967;

const setEspn = (state: object) =>
  fetch(`${ESPN_STUB_URL}/__set`, { method: "POST", body: JSON.stringify(state) }).then((r) => {
    if (!r.ok) throw new Error("could not set the ESPN stand-in");
  });

test("check, apply and see the result scored; then nothing new; then ESPN down keeps hand entry available", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const adminEmail = db.email("espnadm");
    const admin = await signIn(browser, db, adminEmail);
    await db.setUser(adminEmail, "Espn Admin", true);
    const loserId = await db.createPlayer("loser", "Picked Buffalo");
    const winnerId = await db.createPlayer("winner", "Picked Kansas City");

    const poolId = await db.createPool("Espn Pool", SEASON);
    const g1 = await db.createGame(SEASON, 1, "KC", "BUF");
    await db.createGame(SEASON, 1, "DET", "NYJ");
    await db.setKickoffIn(g1, -7200);
    const g2 = (await db.query(`select id from games where season_year = $1 and home_team = 'DET'`, [SEASON])).rows[0].id as string;
    await db.setKickoffIn(g2, -3600);
    const loserEntry = await db.createEntry(poolId, loserId);
    const winnerEntry = await db.createEntry(poolId, winnerId);
    await db.addPick(loserEntry, 1, "BUF");
    await db.addPick(winnerEntry, 1, "KC");

    await setEspn({
      mode: "ok",
      games: [
        { week: 1, home: "KC", away: "BUF", final: true, homeScore: 27, awayScore: 24 },
        { week: 1, home: "DET", away: "NYJ", final: false, homeScore: 7, awayScore: 3 },
      ],
    });

    await admin.goto("/admin/results");
    await expect(admin.getByRole("heading", { name: "Results", exact: true })).toBeVisible();

    // Checking shows what finished and changes nothing yet.
    await admin.getByRole("button", { name: "Check for results" }).click();
    await expect(admin.getByText("1 game finished")).toBeVisible();
    await expect(admin.getByText("Bills at Chiefs: Chiefs won 27-24")).toBeVisible();
    expect((await db.query(`select result from games where id = $1`, [g1])).rows[0].result).toBe("pending");

    // Applying saves and scores it like a hand-entered result.
    await admin.getByRole("button", { name: "Apply 1 result" }).click();
    await expect(admin.getByText("Saved 1 result.")).toBeVisible();
    const saved = (await db.query(`select result, home_score, away_score from games where id = $1`, [g1])).rows[0];
    expect(saved).toMatchObject({ result: "home_win", home_score: 27, away_score: 24 });
    expect((await db.query(`select status, eliminated_week from entries where id = $1`, [loserEntry])).rows[0]).toMatchObject({
      status: "eliminated",
      eliminated_week: 1,
    });
    expect((await db.query(`select status from entries where id = $1`, [winnerEntry])).rows[0].status).toBe("alive");
    expect(
      Number((await db.query(`select count(*) from admin_activity where kind = 'results_imported'`)).rows[0].count)
    ).toBeGreaterThanOrEqual(1);

    // The other game is still in progress, so there is nothing new.
    await admin.getByRole("button", { name: "Check for results" }).click();
    await expect(admin.getByText("Nothing new to apply.")).toBeVisible();
    await admin.getByRole("button", { name: "Done" }).click();

    // ESPN down: a plain message, and entering by hand still works.
    await setEspn({ mode: "down", games: [] });
    await admin.getByRole("button", { name: "Check for results" }).click();
    await expect(admin.getByRole("alert").filter({ hasText: "enter results by hand" })).toBeVisible();
    await expect(admin.getByRole("button", { name: /Detroit Lions won|DET/ }).first()).toBeVisible();

    // A player cannot reach it.
    const player = await signIn(browser, db, db.email("espnplayer"));
    expect((await apiCall(player, "GET", "/admin/results/espn")).status).toBe(403);
    expect((await apiCall(player, "POST", "/admin/results/espn/apply", { gameIds: [g1] })).status).toBe(403);

    await player.context().close();
    await admin.context().close();
  } finally {
    await db.close();
  }
});
