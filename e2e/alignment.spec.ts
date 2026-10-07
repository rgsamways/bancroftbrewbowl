import { expect, test, type Page } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";
import { E2E_OPERATOR_EMAIL } from "./env";

// Every screen keeps its text inside the same centred column on a wide window. (On a phone the column
// is the screen; on a desktop it is a 512 pixel column with 24 pixel padding, so text sits in the
// middle 464 pixels.) A title or a table drawn outside it is the kind of slip this catches.

const WIDE = { width: 1280, height: 900 };
const COLUMN = { left: (WIDE.width - 512) / 2 + 24, right: (WIDE.width + 512) / 2 - 24 }; // 408 to 872
const SLACK = 2;

/** The leftmost and rightmost edge of the visible text in the page (not the fixed bars). */
async function textExtent(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector("main") ?? document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let left = Infinity;
    let right = 0;
    let count = 0;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      const el = node.parentElement;
      if (!el || el.closest("header, nav, script, style, [aria-hidden='true']")) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.width === 0 || rect.height === 0) continue;
        left = Math.min(left, rect.left);
        right = Math.max(right, rect.right);
        count++;
      }
    }
    return { left, right, count };
  });
}

test("every screen keeps its text inside the centred column on a wide window", async ({ browser }) => {
  test.setTimeout(240_000);
  const db = new TestDb();
  await db.connect();
  try {
    const SEASON = 2962;
    const email = db.adopt(E2E_OPERATOR_EMAIL); // the god-user passes every admin check and sees site setup
    const page = await signIn(browser, db, email);
    const userId = await db.setUser(email, "Wide Screen Will");
    await page.setViewportSize(WIDE);

    const poolId = await db.createPool("Alignment Pool", SEASON);
    const otherPool = await db.createPool("Alignment Other", SEASON);
    await db.createGame(SEASON, 1, "KC", "BUF", 2);
    await db.createGame(SEASON, 1, "DET", "NYJ", 2);
    const entryId = await db.createEntry(poolId, userId);

    const paths = [
      "/",
      "/standings",
      "/pick",
      `/pool/${poolId}`,
      `/pool/${poolId}?view=weeks`,
      `/pool/${poolId}/entry/${entryId}/pick`,
      `/pool/${poolId}/recap`,
      `/join/${otherPool}`,
      "/menu",
      "/menu/kitchen",
      "/menu/music",
      "/account",
      "/account/password",
      "/help",
      "/admin",
      "/admin/results",
      "/admin/results/steps",
      "/admin/more",
      "/admin/activity",
      "/admin/brewery",
      "/admin/notices",
      "/admin/tv",
      "/admin/tv/playlists/new",
      "/admin/brewery/feature",
      "/admin/brewery/special",
      "/admin/brewery/announcement",
      "/admin/guide",
      "/admin/menu",
      "/admin/menu?tab=kitchen",
      "/admin/menu?tab=music",
      "/admin/menu/new",
      "/admin/music/new",
      "/admin/pools",
      "/admin/pools/new",
      `/admin/pools/${poolId}`,
      `/admin/pools/${poolId}?tab=picks`,
      `/admin/pools/${poolId}?tab=settings`,
      "/admin/setup/schedule",
      "/admin/setup/admins",
      "/admin/setup/tv",
      "/admin/setup/sign-in",
    ];

    const problems: string[] = [];
    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(150);
      const { left, right, count } = await textExtent(page);
      if (count === 0) {
        problems.push(`${path}: no text found`);
        continue;
      }
      if (left < COLUMN.left - SLACK || right > COLUMN.right + SLACK) {
        problems.push(`${path}: text spans ${Math.round(left)} to ${Math.round(right)}, column is ${COLUMN.left} to ${COLUMN.right}`);
      }
    }
    expect(problems).toEqual([]);

    // The pages a signed-out visitor sees.
    const visitor = await (await browser.newContext({ viewport: WIDE })).newPage();
    const visitorProblems: string[] = [];
    for (const path of ["/", "/menu", "/menu/kitchen", "/menu/music"]) {
      await visitor.goto(path);
      await visitor.waitForLoadState("networkidle");
      await visitor.waitForTimeout(150);
      const { left, right, count } = await textExtent(visitor);
      if (count === 0) visitorProblems.push(`${path}: no text found`);
      else if (left < COLUMN.left - SLACK || right > COLUMN.right + SLACK) {
        visitorProblems.push(`${path}: text spans ${Math.round(left)} to ${Math.round(right)}`);
      }
    }
    expect(visitorProblems).toEqual([]);

    await page.context().close();
    await visitor.context().close();
  } finally {
    await db.close();
  }
});
