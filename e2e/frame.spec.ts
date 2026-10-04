import { expect, test, type Page } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";

// The app frame (header, bottom tabs, Pick and Standings redirects) for each kind of user.
// Promoted from the walk-shell walkthrough. Screens are checked by their frame behaviour,
// not their wording, so rebuilding a screen later does not mean rewriting this file.

const SEASON = 2991;
const roles = ["nopool", "one", "several", "outonly", "admin"] as const;
type Role = (typeof roles)[number];

const db = new TestDb();
const pages = {} as Record<Role, Page>;
let poolA = "";
let poolB = "";
const entry = {} as Record<string, string>;

const tabLinks = (p: Page) =>
  p.$$eval('nav[aria-label="Main"] a', (as) => as.map((a) => ({ label: a.textContent!.trim(), current: a.getAttribute("aria-current") === "page" })));
const tabLabels = async (p: Page) => (await tabLinks(p)).map((t) => t.label).join(" | ");
const currentTab = async (p: Page) => (await tabLinks(p)).filter((t) => t.current).map((t) => t.label).join(",") || "(none)";
const noSideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const go = async (p: Page, path: string) => {
  await p.goto(path);
  await p.waitForSelector("header");
};

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  await db.connect();
  const emails = {} as Record<Role, string>;
  for (const r of roles) {
    emails[r] = db.email(r);
    pages[r] = await signIn(browser, db, emails[r]);
  }
  const names: Record<Role, string> = { nopool: "Nina NoPool", one: "Owen One", several: "Sam Several", outonly: "Olive Out", admin: "Ada Admin" };
  const ids = {} as Record<Role, string>;
  for (const r of roles) ids[r] = await db.setUser(emails[r], names[r], r === "admin");

  poolA = await db.createPool("Alpha Survivor", SEASON);
  poolB = await db.createPool("Bravo Survivor", SEASON);
  await db.createGame(SEASON, 1, "KC", "BUF");
  entry.one = await db.createEntry(poolA, ids.one);
  entry.severalA = await db.createEntry(poolA, ids.several);
  entry.severalB = await db.createEntry(poolB, ids.several, "eliminated");
  entry.outonly = await db.createEntry(poolA, ids.outonly, "eliminated");
  entry.admin = await db.createEntry(poolA, ids.admin);
});

test.afterAll(async () => {
  await db.close();
});

test("a player with no pools: tabs, header, and the join-a-pool message", async () => {
  const p = pages.nopool;
  await go(p, "/");
  expect(await tabLabels(p)).toBe("Home | Pick | Standings");
  expect(await currentTab(p)).toBe("Home");
  expect(await p.$$('button[aria-label="Open navigation"], button[aria-label="Page help"], aside')).toHaveLength(0);
  await expect(p.locator('header a[aria-label="Brew Bowl home"]')).toHaveAttribute("href", "/");
  await expect(p.locator('header a[aria-label="Me"]')).toHaveText("NN");

  await p.click('nav[aria-label="Main"] a:has-text("Pick")');
  await expect(p.getByText("You haven't joined a pool yet")).toBeVisible();
  await expect(p.locator('a:has-text("Go to Home")')).toBeVisible();
  expect(await currentTab(p)).toBe("Pick");

  await p.click('nav[aria-label="Main"] a:has-text("Standings")');
  await expect(p.getByText("You haven't joined a pool yet")).toBeVisible();
  expect(await currentTab(p)).toBe("Standings");
});

test("the avatar opens Me, no tab is marked there, and Sign out signs out", async () => {
  const p = pages.nopool;
  await p.click('header a[aria-label="Me"]');
  await expect(p.getByRole("button", { name: "Sign out" })).toBeVisible();
  expect(new URL(p.url()).pathname).toBe("/account");
  expect(await currentTab(p)).toBe("(none)");

  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const clear = await p.evaluate(() => {
    const signOut = [...document.querySelectorAll("button")].find((b) => b.textContent!.includes("Sign out"))!;
    const nav = document.querySelector('nav[aria-label="Main"]')!;
    return signOut.getBoundingClientRect().bottom <= nav.getBoundingClientRect().top;
  });
  expect(clear, "last line of a long page sits clear above the tab bar").toBe(true);

  await p.getByRole("button", { name: "Sign out" }).click();
  await expect(p.getByText("Email me a sign-in link")).toBeVisible();
});

test("one alive pool: Pick goes straight to the pick screen, Standings to the pool", async () => {
  const p = pages.one;
  await go(p, "/");
  await p.click('nav[aria-label="Main"] a:has-text("Pick")');
  await p.waitForURL(`**/pool/${poolA}/entry/${entry.one}/pick`);
  await expect(p.getByText("Week 1 pick")).toBeVisible();
  expect(await currentTab(p)).toBe("Pick");

  await p.click('nav[aria-label="Main"] a:has-text("Standings")');
  await p.waitForURL(`**/pool/${poolA}`);
  await expect(p.getByText("Alpha Survivor").first()).toBeVisible();
  expect(await currentTab(p)).toBe("Standings");
});

test("several pools: Pick goes to the pool that needs a pick; Standings lists them", async () => {
  const p = pages.several;
  await go(p, "/pick");
  await p.waitForURL(`**/pool/${poolA}/entry/${entry.severalA}/pick`); // the alive pool, not the one they are out of
  await expect(p.getByText("Week 1 pick")).toBeVisible();

  // Standings opens the same pool, with a tab for each pool the player is in.
  await go(p, "/standings");
  await p.waitForURL(`**/pool/${poolA}`);
  const tabs = await p.$$eval('nav[aria-label="Your pools"] a', (as) => as.map((a) => ({ text: a.textContent!.trim(), href: a.getAttribute("href")! })));
  expect(tabs.map((t) => t.href).sort()).toEqual([`/pool/${poolA}`, `/pool/${poolB}`].sort());
  await p.click(`nav[aria-label="Your pools"] a[href="/pool/${poolB}"]`);
  await p.waitForURL(`**/pool/${poolB}`);
  await expect(p.getByRole("heading", { name: "You're out" })).toBeVisible();
});

test("only entry eliminated: Pick shows their season, with the way to standings", async () => {
  const p = pages.outonly;
  await go(p, "/pick");
  await p.waitForURL(`**/pool/${poolA}/entry/${entry.outonly}/pick`);
  await expect(p.getByRole("heading", { name: "Your season" })).toBeVisible();
  await expect(p.getByRole("link", { name: "See standings" })).toHaveAttribute("href", `/pool/${poolA}`);
});

test("an admin gets an Admin tab and the admin pages stay reachable inside the frame", async () => {
  const p = pages.admin;
  await go(p, "/");
  expect(await tabLabels(p)).toBe("Home | Pick | Standings | Admin");

  await p.click('nav[aria-label="Main"] a:has-text("Admin")');
  await p.waitForURL("**/admin");
  await p.waitForSelector('a[href="/admin/schedule"]');
  expect(await currentTab(p)).toBe("Admin");
  expect(await p.$$('a[href="/admin"], a[href="/admin/schedule"], a[href="/admin/promotions"]')).not.toHaveLength(0);

  await p.click('a[href="/admin/schedule"]');
  await expect(p.getByText("Season").first()).toBeVisible();
  expect(new URL(p.url()).pathname).toBe("/admin/schedule");
  expect(await currentTab(p)).toBe("Admin");

  await p.click('a[href="/admin/promotions"]');
  await p.waitForURL("**/admin/promotions");

  await go(p, `/admin/${poolA}`);
  await expect(p.locator('button:text-is("Picks")')).toBeVisible();
  await expect(p.locator('button:text-is("Entries")')).toBeVisible();
});

test("a non-admin never sees the Admin tab", async () => {
  expect(await tabLabels(pages.several)).not.toContain("Admin");
});

test("no sideways scrolling on any frame screen at 390 wide", async () => {
  const routes: [Role, string][] = [
    ["one", "/"], ["one", "/account"], ["one", "/pick"], ["several", "/pick"], ["several", "/standings"],
    ["one", `/pool/${poolA}`], ["one", `/pool/${poolA}/entry/${entry.one}/pick`],
    ["admin", "/admin"], ["admin", "/admin/schedule"], ["admin", "/admin/promotions"], ["admin", `/admin/${poolA}`],
  ];
  const bad: string[] = [];
  for (const [role, path] of routes) {
    await go(pages[role], path);
    if (!(await noSideways(pages[role]))) bad.push(path);
  }
  expect(bad, `screens that scroll sideways: ${bad.join(", ")}`).toEqual([]);
});

test("tabs, avatar and logo are at least 44 px to tap", async () => {
  const p = pages.admin;
  await go(p, "/");
  const sizes = await p.evaluate(() => {
    const box = (el: Element) => el.getBoundingClientRect();
    return {
      tabs: [...document.querySelectorAll('nav[aria-label="Main"] a')].map((a) => Math.round(box(a).height)),
      avatar: [Math.round(box(document.querySelector('header a[aria-label="Me"]')!).width), Math.round(box(document.querySelector('header a[aria-label="Me"]')!).height)],
      logo: Math.round(box(document.querySelector('header a[aria-label="Brew Bowl home"]')!).height),
    };
  });
  for (const h of sizes.tabs) expect(h).toBeGreaterThanOrEqual(44);
  for (const s of sizes.avatar) expect(s).toBeGreaterThanOrEqual(44);
  expect(sizes.logo).toBeGreaterThanOrEqual(44);
});

test("Inter font, near-black background, and a copper highlighted tab", async () => {
  const p = pages.one;
  await go(p, "/");
  const look = await p.evaluate(() => ({
    font: getComputedStyle(document.body).fontFamily,
    bg: getComputedStyle(document.body).backgroundColor,
    active: getComputedStyle(document.querySelector('nav[aria-label="Main"] a[aria-current="page"]')!).color,
    loaded: document.fonts.check("16px Inter"),
  }));
  expect(look.font).toContain("Inter");
  expect(look.loaded).toBe(true);
  expect(look.bg).toBe("rgb(14, 14, 15)");
  expect(look.active).toBe("rgb(193, 122, 69)");
});
