import { expect, test } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

// The pool total is a number an admin types; players see it on Standings. No money moves.

const SEASON = 2992;
const NOTE = "Cash handled at the bar, not in this app.";

test("an admin sets the pool total, players see it on Standings, and clearing hides it", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const adminEmail = db.email("totaladmin");
    const playerEmail = db.email("totalplayer");
    const admin = await signIn(browser, db, adminEmail);
    const player = await signIn(browser, db, playerEmail);
    const adminId = await db.setUser(adminEmail, "Total Admin", true);
    const playerId = await db.setUser(playerEmail, "Total Player");
    const poolId = await db.createPool("Total Pool", SEASON);
    await db.createEntry(poolId, playerId);
    await db.createEntry(poolId, adminId);

    // No total yet: no card.
    await player.goto(`/pool/${poolId}`);
    await expect(player.getByText("Still alive 2")).toBeVisible();
    await expect(player.getByText("Pool total")).toHaveCount(0);

    // The admin opens the pool's settings. The pool is locked (active), and the field still works.
    await admin.goto(`/admin/${poolId}`);
    await admin.getByRole("button", { name: "Pool settings" }).click();
    const field = admin.getByLabel("Shown to players on Standings");
    await expect(admin.getByRole("button", { name: "Save changes" })).toBeDisabled();
    await expect(field).toBeEnabled();

    await field.fill("lots");
    await admin.getByRole("button", { name: "Save pool total" }).click();
    await expect(admin.getByText("Enter the amount as a number, like 320 or 320.50.")).toBeVisible();
    await field.fill("-5");
    await admin.getByRole("button", { name: "Save pool total" }).click();
    await expect(admin.getByText("Enter an amount of $0 or more.")).toBeVisible();
    await field.fill("2000000");
    await admin.getByRole("button", { name: "Save pool total" }).click();
    await expect(admin.getByText("That amount is too large.")).toBeVisible();

    await field.fill("320");
    await admin.getByRole("button", { name: "Save pool total" }).click();
    await expect(admin.getByText("Saved.")).toBeVisible();

    await player.reload();
    await expect(player.getByText("$320", { exact: true })).toBeVisible();
    await expect(player.getByText(NOTE)).toBeVisible();

    await field.fill("320.50");
    await admin.getByRole("button", { name: "Save pool total" }).click();
    await expect(admin.getByText("Saved.")).toBeVisible();
    await player.reload();
    await expect(player.getByText("$320.50", { exact: true })).toBeVisible();

    await field.fill("");
    await admin.getByRole("button", { name: "Save pool total" }).click();
    await expect(admin.getByText("Saved.")).toBeVisible();
    await player.reload();
    await expect(player.getByText("Still alive 2")).toBeVisible();
    await expect(player.getByText("Pool total")).toHaveCount(0);

    await admin.context().close();
    await player.context().close();
  } finally {
    await db.close();
  }
});

test("a pick 'em pool shows the pool total too", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const email = db.email("pickemtotal");
    const page = await signIn(browser, db, email);
    const userId = await db.setUser(email, "Pickem Player");
    const poolId = await db.createPool("Pickem Total", SEASON, "pick_em");
    await db.createEntry(poolId, userId);
    await db.query(`update pools set pool_total_cents = 20500 where id = $1`, [poolId]);

    await page.goto(`/pool/${poolId}`);
    await expect(page.getByText("$205", { exact: true })).toBeVisible();
    await expect(page.getByText(NOTE)).toBeVisible();
    await page.context().close();
  } finally {
    await db.close();
  }
});
