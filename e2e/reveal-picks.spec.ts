import { expect, test } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";
import { apiCall } from "./helpers/api";

// A pool that waits to show picks until the week's last game is final: the admin Picks tab and the
// server keep other players' teams hidden after the lock, and show them once every game has a result.

const SEASON = 2969;

test("after_final_game: teams stay hidden after the lock and show once every game has a result", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const adminEmail = db.email("adm");
    const viewerEmail = db.email("viewer");
    const otherEmail = db.email("other");
    const admin = await signIn(browser, db, adminEmail);
    const viewer = await signIn(browser, db, viewerEmail);
    await signIn(browser, db, otherEmail);
    const adminId = await db.setUser(adminEmail, "Reveal Admin", true);
    const viewerId = await db.setUser(viewerEmail, "Reveal Viewer");
    const otherId = await db.setUser(otherEmail, "Reveal Other");

    const poolId = await db.createPool("Reveal Pool", SEASON, "survivor", { reveal_picks: "after_final_game" });
    const g1 = await db.createGame(SEASON, 1, "KC", "BUF");
    const g2 = await db.createGame(SEASON, 1, "DET", "NYJ");
    await db.setKickoffIn(g1, -7200);
    await db.setKickoffIn(g2, -3600);
    await db.createEntry(poolId, adminId);
    await db.createEntry(poolId, viewerId);
    const otherEntry = await db.createEntry(poolId, otherId);
    await db.addPick(otherEntry, 1, "KC");

    // The week has locked but a game is undecided: hidden from a player and from an admin.
    expect((await apiCall<unknown[]>(viewer, "GET", `/pools/${poolId}/picks`)).json).toEqual([]);
    await admin.goto(`/admin/pools/${poolId}?tab=picks`);
    const row = admin.locator("main ul li").filter({ hasText: "Reveal Other" });
    await expect(row).toContainText("Picked");
    await expect(row).toContainText("Team hidden until the week's games are final");
    await expect(admin.getByText("Teams are hidden until every game of the week has a result.")).toBeVisible();
    expect(await admin.locator("main").innerText()).not.toMatch(/Chiefs|\bKC\b/);

    // Both games get a result: the same screen now shows the team, and the server shows the pick.
    await db.decideGame(g1, "home_win");
    await db.decideGame(g2, "away_win");
    const shown = (await apiCall<{ teamCode: string }[]>(viewer, "GET", `/pools/${poolId}/picks`)).json!;
    expect(shown.map((p) => p.teamCode)).toEqual(["KC"]);
    await admin.reload();
    await expect(admin.locator("main ul li").filter({ hasText: "Reveal Other" })).toContainText("Chiefs");
    await expect(admin.getByText("This week has locked, so everyone can see everyone's picks.")).toBeVisible();

    await admin.context().close();
    await viewer.context().close();
  } finally {
    await db.close();
  }
});
