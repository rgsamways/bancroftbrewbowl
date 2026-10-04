import { expect, test, type Browser, type Page } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";
import { apiCall } from "./helpers/api";

// "Another admin confirms": an admin who keeps their own entry alive in a wipeout, or edits their
// own status, asks a second admin instead of changing anything. Two real admins, two browsers.
// The admin summary looks at the latest season that has games, so each test uses its own season.

let nextSeason = 3800;

async function newAdmin(browser: Browser, db: TestDb, label: string, name: string) {
  const email = db.email(label);
  const page = await signIn(browser, db, email);
  const userId = await db.setUser(email, name, true);
  return { page, userId };
}

const noSideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test("keeping yourself alive asks another admin, who can decline with a reason, then confirm", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const S = nextSeason++;
    const wanda = await newAdmin(browser, db, "cfa", "Wanda Ask");
    const sam = await newAdmin(browser, db, "cfb", "Sam Second");
    const otherId = await db.createPlayer("cfother", "Otto Other");
    const poolId = await db.createPool("Confirm Survivor", S);
    const gameId = await db.createGame(S, 1, "KC", "BUF", -0.5);
    const mine = await db.createEntry(poolId, wanda.userId);
    const theirs = await db.createEntry(poolId, otherId);
    await db.addPick(mine, 1, "KC");
    await db.addPick(theirs, 1, "KC");
    const status = async (id: string) => (await db.query(`select status from entries where id = $1`, [id])).rows[0].status as string;

    // BUF wins: both pickers would be out, so the result is held back for a decision.
    expect((await apiCall(wanda.page, "POST", `/nfl/games/${gameId}/result`, { result: "away_win" })).status).toBe(200);

    // Wanda ticks her own name: the screen says another admin has to confirm.
    await wanda.page.goto("/admin");
    await wanda.page.getByRole("link", { name: "Resolve it" }).click();
    await expect(wanda.page.getByRole("button", { name: "Eliminate everyone" })).toBeVisible();
    await wanda.page.locator("li", { hasText: "Wanda Ask" }).getByRole("checkbox").check();
    await expect(wanda.page.getByText("You ticked your own name.")).toBeVisible();
    expect(await noSideways(wanda.page)).toBe(true);
    await wanda.page.getByRole("button", { name: "Ask another admin to confirm" }).click();
    await expect(wanda.page.getByRole("heading", { name: "Sent for confirmation" })).toBeVisible();
    await expect(wanda.page.getByText(/Sam Second/)).toBeVisible();
    expect(await status(mine)).toBe("alive"); // nothing changed
    await wanda.page.getByRole("link", { name: "Back to your steps" }).click();
    await expect(wanda.page.getByText("Waiting for another admin.")).toBeVisible();

    // Sam sees it as his next step and reviews what was chosen.
    await sam.page.goto("/admin");
    await expect(sam.page.getByRole("heading", { name: "Confirm a decision from Wanda Ask" })).toBeVisible();
    await sam.page.getByRole("link", { name: "Start" }).click();
    await expect(sam.page.getByRole("heading", { name: "Confirm a decision" })).toBeVisible();
    await expect(sam.page.locator("li", { hasText: "Wanda Ask" })).toContainText("Kept alive");
    await expect(sam.page.locator("li", { hasText: "Otto Other" })).toContainText("Eliminated");
    expect(await noSideways(sam.page)).toBe(true);

    // Sam does not confirm, with a reason.
    await sam.page.getByRole("link", { name: "Don't confirm" }).click();
    await sam.page.getByRole("button", { name: "Check the result first" }).click();
    await sam.page.getByRole("button", { name: "Send" }).click();
    await expect(sam.page.getByRole("heading", { name: "Not confirmed" })).toBeVisible();
    expect(await status(mine)).toBe("alive");

    // Wanda sees why, and chooses again.
    await wanda.page.goto("/admin");
    await expect(wanda.page.getByText("Needs another look", { exact: true })).toBeVisible();
    await expect(wanda.page.getByText("Reason: \"Check the result first\"")).toBeVisible();
    await wanda.page.getByRole("link", { name: "Review and choose again" }).click();
    await wanda.page.locator("li", { hasText: "Wanda Ask" }).getByRole("checkbox").check();
    await wanda.page.getByRole("button", { name: "Ask another admin to confirm" }).click();
    await expect(wanda.page.getByRole("heading", { name: "Sent for confirmation" })).toBeVisible();

    // Sam confirms this time, and the choice is applied.
    await sam.page.goto("/admin");
    await sam.page.getByRole("link", { name: "Start" }).click();
    await sam.page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(sam.page.getByRole("heading", { name: "Confirmed" })).toBeVisible();
    expect(await status(mine)).toBe("alive");
    expect(await status(theirs)).toBe("eliminated");

    // Both steps are in Activity.
    const kinds = (await db.query(`select kind from admin_activity where actor_id = any($1) order by created_at`, [[wanda.userId, sam.userId]])).rows.map(
      (r) => r.kind as string
    );
    expect(kinds).toEqual(["result_entered", "confirmation_requested", "confirmation_declined", "confirmation_requested", "confirmation_confirmed"]);
    await wanda.page.context().close();
    await sam.page.context().close();
  } finally {
    await db.close();
  }
});

test("changing your own status asks another admin; the roster says so first", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const S = nextSeason++;
    const wanda = await newAdmin(browser, db, "cfc", "Wanda Status");
    const sam = await newAdmin(browser, db, "cfd", "Sam Status");
    const poolId = await db.createPool("Status Survivor", S);
    await db.createGame(S, 1, "KC", "BUF", 2);
    const mine = await db.createEntry(poolId, wanda.userId);

    await wanda.page.goto(`/admin/pools/${poolId}?tab=players`);
    await wanda.page.getByRole("button", { name: /Wanda Status/ }).click();
    await expect(wanda.page.getByText(/another admin has to confirm a change to it/)).toBeVisible();
    await wanda.page.getByRole("button", { name: "Out", exact: true }).click();
    await wanda.page.getByLabel("Out in week").fill("3");
    await wanda.page.getByRole("button", { name: "Save" }).click();
    await expect(wanda.page.getByRole("heading", { name: "Sent for confirmation" })).toBeVisible();
    expect((await db.query(`select status from entries where id = $1`, [mine])).rows[0].status).toBe("alive");

    await sam.page.goto("/admin");
    await sam.page.getByRole("link", { name: "Start" }).click();
    await expect(sam.page.getByText("Out in week 3")).toBeVisible();
    await sam.page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(sam.page.getByRole("heading", { name: "Confirmed" })).toBeVisible();
    expect((await db.query(`select status, eliminated_week from entries where id = $1`, [mine])).rows[0]).toMatchObject({
      status: "eliminated",
      eliminated_week: 3,
    });
    await wanda.page.context().close();
    await sam.page.context().close();
  } finally {
    await db.close();
  }
});
