import { expect, test } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

// A new account is named with its email until the player sets a display name. Home asks for one,
// and other players never see the address.

const SEASON = 2968;

test("an email-named player is asked for a name; saving it removes the card and shows on Standings", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const lark = db.email("lark");
    const robin = db.email("robin");
    const larkPage = await signIn(browser, db, lark);
    const robinPage = await signIn(browser, db, robin);
    const larkId = (await db.query(`select id from "user" where email = $1`, [lark])).rows[0].id as string;
    const robinId = await db.setUser(robin, "Robin Named");
    const poolId = await db.createPool("Names Pool", SEASON);
    await db.createGame(SEASON, 1, "KC", "BUF");
    await db.createEntry(poolId, larkId);
    await db.createEntry(poolId, robinId);

    // Robin sees the other player by the part before the @, never the address.
    await robinPage.goto(`/pool/${poolId}`);
    const localPart = lark.split("@")[0]!;
    await expect(robinPage.getByText(localPart, { exact: true })).toBeVisible();
    expect(await robinPage.locator("main").innerText()).not.toContain("@");

    // Robin has a real name: no card.
    await robinPage.goto("/");
    await expect(robinPage.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(robinPage.getByText("What should we call you?")).toHaveCount(0);

    // Lark is asked, and nothing blocks the rest of Home.
    await larkPage.goto("/");
    await expect(larkPage.getByText("What should we call you?")).toBeVisible();
    await expect(larkPage.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await larkPage.getByLabel("What should we call you?").fill("Lark P.");
    await larkPage.getByRole("button", { name: "Save name" }).click();
    await expect(larkPage.getByText("What should we call you?")).toHaveCount(0);

    // The new name shows to the other player, and the card stays gone after a reload.
    await robinPage.goto(`/pool/${poolId}`);
    await expect(robinPage.getByText("Lark P.", { exact: true })).toBeVisible();
    await larkPage.reload();
    await expect(larkPage.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(larkPage.getByText("What should we call you?")).toHaveCount(0);

    await larkPage.context().close();
    await robinPage.context().close();
  } finally {
    await db.close();
  }
});
