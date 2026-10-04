import { expect, test, type Page } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";
import { apiCall } from "./helpers/api";

// Pick privacy and ownership (the secure-pick-access rules), as a player and an admin
// actually meet them: in the screens and through the API with a real session.
// Promoted from the walk-secure walkthrough.

const SEASON = 2992;

type PickRow = { weekNumber: number; teamCode: string };
type PoolPickRow = { entryId: string; teamCode: string | null };
type EntryRow = { id: string; email: string };
const db = new TestDb();
let player: Page;
let admin: Page;
let poolId = "";
const entry = {} as Record<"player" | "other" | "admin", string>;
const emails = {} as Record<"player" | "other" | "admin", string>;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  await db.connect();
  for (const r of ["player", "other", "admin"] as const) emails[r] = db.email(r);
  player = await signIn(browser, db, emails.player);
  await signIn(browser, db, emails.other); // the other player only needs to exist
  admin = await signIn(browser, db, emails.admin);

  const ids = {
    player: await db.setUser(emails.player, "Walk Player"),
    other: await db.setUser(emails.other, "Walk Other"),
    admin: await db.setUser(emails.admin, "Walk Admin", true),
  };
  poolId = await db.createPool("Privacy Pool", SEASON);
  await db.createGame(SEASON, 1, "KC", "BUF");
  for (const r of ["player", "other", "admin"] as const) entry[r] = await db.createEntry(poolId, ids[r]);
  await db.addPick(entry.other, 1, "PHI");
  await db.addPick(entry.admin, 1, "DAL");
});

test.afterAll(async () => {
  await db.close();
});

test("standings: only your own name links to a pick screen", async () => {
  await player.goto(`/pool/${poolId}`);
  await expect(player.getByText("Walk Other")).toBeVisible();
  const links = await player.$$eval('section a[href*="/entry/"]', (as) => as.map((a) => a.textContent!.trim()));
  expect(links).toEqual(["Walk Player"]);
});

test("someone else's pick screen says it isn't your entry and offers no teams", async () => {
  await player.goto(`/pool/${poolId}/entry/${entry.other}/pick`);
  await expect(player.getByText("That isn't your entry")).toBeVisible();
  await expect(player.getByRole("button", { name: /^(KC|BUF|PHI|DAL)/ })).toHaveCount(0);
});

test("your own pick screen lets you pick, and the pick is saved on the server", async () => {
  await player.goto(`/pool/${poolId}/entry/${entry.player}/pick`);
  await player.getByRole("button", { name: /^KC/ }).click();
  await player.getByRole("button", { name: "Lock in Chiefs" }).click();
  await expect(player.getByRole("heading", { name: "Locked in" })).toBeVisible();
  const mine = await apiCall<PickRow[]>(player, "GET", `/entries/${entry.player}/picks`);
  expect(mine.status).toBe(200);
  expect(mine.json!.some((p) => p.weekNumber === 1 && p.teamCode === "KC")).toBe(true);
});

test("the server hides other players' unlocked picks and emails from a player", async () => {
  const poolPicks = await apiCall<PoolPickRow[]>(player, "GET", `/pools/${poolId}/picks`);
  expect(poolPicks.json!.some((r) => r.entryId === entry.other)).toBe(false);
  expect(poolPicks.json!.some((r) => r.entryId === entry.player && r.teamCode === "KC")).toBe(true);

  const theirs = await apiCall<PickRow[]>(player, "GET", `/entries/${entry.other}/picks`);
  expect(theirs.status).toBe(200);
  expect(theirs.json).toEqual([]);

  const list = await apiCall<EntryRow[]>(player, "GET", `/pools/${poolId}/entries`);
  const emailOf = (id: string) => list.json!.find((e) => e.id === id)?.email;
  expect(emailOf(entry.player)).toBe(emails.player);
  expect(emailOf(entry.other)).toBe("");
  expect(emailOf(entry.admin)).toBe("");
});

test("a player cannot change or delete another player's pick (403), and it stays untouched", async () => {
  const change = await apiCall(player, "POST", `/entries/${entry.other}/picks`, { week_number: 1, team_code: "BUF" });
  expect(change.status).toBe(403);
  const remove = await apiCall(player, "DELETE", `/entries/${entry.other}/picks/1/PHI`);
  expect(remove.status).toBe(403);
  const still = await db.query(`select team_code from picks where entry_id = $1`, [entry.other]);
  expect(still.rows.map((r) => r.team_code)).toEqual(["PHI"]);
});

test("admin picks table: other players' teams are hidden, the admin's own is shown", async () => {
  await admin.goto(`/admin/${poolId}`);
  await admin.locator('button:text-is("Picks")').click();
  await expect(admin.locator("table")).toBeVisible();
  await expect(admin.getByText("Walk Player")).toBeVisible();
  const cells = await admin.$$eval("tbody tr", (rows) => rows.map((r) => [...r.querySelectorAll("td")].map((c) => c.textContent!.trim())));
  const rowFor = (name: string) => cells.find((c) => c[0] === name) ?? [];
  expect(rowFor("Walk Other")[1]).toBe("Picked");
  expect(rowFor("Walk Player")[1]).toBe("Picked");
  expect(rowFor("Walk Admin")[1]).toBe("DAL");
  expect(await admin.innerText("table")).not.toMatch(/\bPHI\b/);
});

test("an admin still sees every player's email but cannot change a player's pick (403)", async () => {
  const adminList = await apiCall<EntryRow[]>(admin, "GET", `/pools/${poolId}/entries`);
  expect(adminList.json!.every((e) => e.email.includes("@"))).toBe(true);
  const adminChange = await apiCall(admin, "POST", `/entries/${entry.player}/picks`, { week_number: 1, team_code: "BUF" });
  expect(adminChange.status).toBe(403);
});
