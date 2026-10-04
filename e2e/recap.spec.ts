import { expect, test } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

// The weekly recap: a card on Home once a week with picks is decided, and the recap page behind it.

const SEASON = 2997;

test("Home shows the recap card, the recap page tells the week, and Share copies without showing anyone's picks", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const mine = db.email("me");
    const page = await signIn(browser, db, mine);
    const meId = await db.setUser(mine, "Recap Me");
    const poolId = await db.createPool("Recap Pool", SEASON);
    // Week 1 decided: KC beat BUF, NYJ won at DET. Week 2 still to play.
    const g1 = await db.createGame(SEASON, 1, "KC", "BUF");
    const g2 = await db.createGame(SEASON, 1, "DET", "NYJ");
    await db.createGame(SEASON, 2, "KC", "DET", 9);
    await db.setKickoffIn(g1, -7200);
    await db.setKickoffIn(g2, -3600);
    await db.decideGame(g1, "home_win");
    await db.decideGame(g2, "away_win");

    const meEntry = await db.createEntry(poolId, meId);
    const picks: Array<[string, string]> = [[meEntry, "KC"]];
    for (const [i, team] of ["KC", "KC", "DET"].entries()) {
      picks.push([await db.createEntry(poolId, await db.createPlayer(`p${i}`, `Player ${i}`)), team]);
    }
    for (const [entry, team] of picks) await db.addPick(entry, 1, team);
    await db.setPickResult(meEntry, 1, "KC", "win");
    await db.eliminate(picks[3]![0], 1);

    await page.goto("/");
    const card = page.getByRole("link", { name: /Week 1 recap/ });
    await expect(card).toBeVisible();
    await card.click();

    await expect(page).toHaveURL(new RegExp(`/pool/${poolId}/recap`));
    await expect(page.getByRole("heading", { name: "Week 1 recap" })).toBeVisible();
    await expect(page.getByText("You survived")).toBeVisible();
    await expect(page.getByTestId("recap-headline")).toHaveText("Still alive after week 1");
    await expect(page.getByText("3 of 4 players left")).toBeVisible();
    await expect(page.getByText("Players out this week").locator("..")).toContainText("1");
    await expect(page.getByText("Most picked").locator("..")).toContainText("Chiefs");
    await expect(page.getByText("Most picked").locator("..")).toContainText("75%");
    await expect(page.getByText("Biggest upset").locator("..")).toContainText("Jets");
    await expect(page.getByText("Biggest upset").locator("..")).toContainText("over Lions");
    await expect(page.getByText("Your pick").locator("..")).toContainText("won");

    // No sideways scroll at 390 wide.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // Share: with no share sheet the text is copied, and it names nobody's pick.
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.evaluate(() => Object.defineProperty(navigator, "share", { value: undefined, configurable: true }));
    await page.getByRole("button", { name: "Share my recap" }).click();
    await expect(page.getByRole("button", { name: "Copied to share" })).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("Still alive after week 1");
    expect(copied).not.toContain("Chiefs");
    expect(copied).not.toContain("Player ");

    await page.getByRole("link", { name: "Back to Home" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.context().close();
  } finally {
    await db.close();
  }
});

test("no recap card before any week has picks, and the page says so", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const mine = db.email("none");
    const page = await signIn(browser, db, mine);
    const meId = await db.setUser(mine, "No Recap Me");
    const poolId = await db.createPool("Quiet Pool", SEASON + 1);
    await db.createGame(SEASON + 1, 1, "KC", "BUF");
    await db.createEntry(poolId, meId);

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /recap/i })).toHaveCount(0);

    await page.goto(`/pool/${poolId}/recap`);
    await expect(page.getByRole("heading", { name: "No recap yet" })).toBeVisible();

    await page.context().close();
  } finally {
    await db.close();
  }
});
