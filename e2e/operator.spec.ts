import { expect, test } from "@playwright/test";
import { TestDb } from "./helpers/db";
import { signIn } from "./helpers/auth";
import { apiCall } from "./helpers/api";
import { E2E_OPERATOR_EMAIL, ESPN_STUB_URL } from "./env";

// Site setup: the god-user (OPERATOR_EMAILS, not flagged as an admin) alone sees and uses it.

const setEspn = (state: object) =>
  fetch(`${ESPN_STUB_URL}/__set`, { method: "POST", body: JSON.stringify(state) }).then((r) => {
    if (!r.ok) throw new Error("could not set the ESPN stand-in");
  });

test("only the god-user sees site setup; an ordinary admin and a player do not", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const god = await signIn(browser, db, db.adopt(E2E_OPERATOR_EMAIL));
    const larkEmail = db.email("lark");
    const lark = await signIn(browser, db, larkEmail);
    await db.setUser(larkEmail, "Lark Admin", true);
    const playerEmail = db.email("player");
    const player = await signIn(browser, db, playerEmail);
    await db.setUser(playerEmail, "Plain Player");

    // The god-user is not flagged as an admin, yet gets the Admin tab, the admin area and Site setup.
    expect((await db.query(`select is_admin from "user" where email = $1`, [E2E_OPERATOR_EMAIL])).rows[0].is_admin).toBeFalsy();
    await god.goto("/");
    await expect(god.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Admin" })).toBeVisible();
    await god.goto("/admin/more");
    await expect(god.getByRole("heading", { name: "More" })).toBeVisible();
    await expect(god.getByRole("heading", { name: "Site setup" })).toBeVisible();
    for (const name of ["Schedule", "Admins", "Help someone sign in"]) {
      await expect(god.getByRole("link", { name: new RegExp(`^${name}`) })).toBeVisible();
    }

    // An ordinary admin has the admin area but not site setup, and its addresses send them back to More.
    await lark.goto("/admin/more");
    await expect(lark.getByRole("heading", { name: "More" })).toBeVisible();
    await expect(lark.getByRole("heading", { name: "Site setup" })).toHaveCount(0);
    await lark.goto("/admin/setup/admins");
    await lark.waitForURL("**/admin/more");
    expect((await apiCall(lark, "GET", "/operator/admins")).status).toBe(403);

    // A player has neither.
    await player.goto("/admin/more");
    await player.waitForURL((url) => url.pathname === "/");
    expect((await apiCall(player, "GET", "/operator/admins")).status).toBe(403);
    await expect(player.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Admin" })).toHaveCount(0);

    for (const p of [god, lark, player]) await p.context().close();
  } finally {
    await db.close();
  }
});

test("Admins: add someone who has signed in, remove them with a confirmation, and say so when there is no account", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const god = await signIn(browser, db, db.adopt(E2E_OPERATOR_EMAIL));
    const candidate = db.email("candidate");
    await db.createPlayer("candidate", "Candidate Cora");

    await god.goto("/admin/setup/admins");
    await expect(god.getByRole("heading", { name: "Admins" })).toBeVisible();

    await god.getByLabel("Add an admin by email").fill(candidate);
    await god.getByRole("button", { name: "Make them an admin" }).click();
    await expect(god.getByText("Candidate Cora is now an admin.")).toBeVisible();
    expect((await db.query(`select is_admin from "user" where email = $1`, [candidate])).rows[0].is_admin).toBe(true);
    const row = god.getByRole("listitem").filter({ hasText: "Candidate Cora" });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Remove" }).click();
    await expect(god.getByText("Remove Candidate Cora's admin access? They can still play.")).toBeVisible();
    await god.getByRole("button", { name: "Remove admin" }).click();
    await expect(god.getByText("Candidate Cora is no longer an admin.")).toBeVisible();
    expect((await db.query(`select is_admin from "user" where email = $1`, [candidate])).rows[0].is_admin).toBe(false);

    await god.getByLabel("Add an admin by email").fill("nobody-has-this-address@example.test");
    await god.getByRole("button", { name: "Make them an admin" }).click();
    await expect(god.getByRole("alert")).toContainText("They need to sign in once first");
    const records = (await db.query(`select count(*) from admin_activity where kind in ('admin_added','admin_removed')`)).rows[0].count;
    expect(Number(records)).toBeGreaterThanOrEqual(2);

    await god.context().close();
  } finally {
    await db.close();
  }
});

test("Help someone sign in: finds the player, then signs them out and removes their password", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  try {
    const god = await signIn(browser, db, db.adopt(E2E_OPERATOR_EMAIL));
    const lockedEmail = db.email("locked");
    const lockedId = await db.createPlayer("locked", "Locked Out Lou");
    await db.query(
      `insert into account (id, account_id, provider_id, user_id, password, created_at, updated_at) values ($1, $2, 'credential', $2, 'x', now(), now())`,
      [crypto.randomUUID(), lockedId]
    );
    await db.query(
      `insert into session (id, token, user_id, expires_at, created_at, updated_at) values ($1, $2, $3, now() + interval '1 day', now(), now())`,
      [crypto.randomUUID(), crypto.randomUUID(), lockedId]
    );

    await god.goto("/admin/setup/sign-in");
    await god.getByLabel("Their email address").fill(lockedEmail);
    await god.getByRole("button", { name: "Find them" }).click();
    await expect(god.getByText("Locked Out Lou", { exact: true })).toBeVisible();
    await expect(god.getByText(/has a password/)).toBeVisible();
    await god.getByRole("button", { name: "Sign them out and remove password" }).click();
    await expect(god.getByText(/Locked Out Lou is signed out everywhere and their password is removed/)).toBeVisible();
    expect(Number((await db.query(`select count(*) from session where user_id = $1`, [lockedId])).rows[0].count)).toBe(0);
    const credentials = await db.query(`select count(*) from account where user_id = $1 and provider_id = 'credential'`, [lockedId]);
    expect(Number(credentials.rows[0].count)).toBe(0);

    await god.getByLabel("Their email address").fill("nobody-has-this-address@example.test");
    await god.getByRole("button", { name: "Find them" }).click();
    await expect(god.getByRole("alert")).toContainText("No account has that email");

    await god.context().close();
  } finally {
    await db.close();
  }
});

test("Schedule: preview what would change, load it, then it is up to date", async ({ browser }) => {
  const db = new TestDb();
  await db.connect();
  const SEASON = new Date().getFullYear() + 1; // the screen's last choice; a season the local data does not use
  try {
    const god = await signIn(browser, db, db.adopt(E2E_OPERATOR_EMAIL));
    db.trackSeason(SEASON);
    const when = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
    await setEspn({
      mode: "ok",
      games: [
        { week: 1, home: "KC", away: "BUF", final: false, homeScore: 0, awayScore: 0, date: when(40) },
        { week: 1, home: "DET", away: "NYJ", final: false, homeScore: 0, awayScore: 0, date: when(40.1) },
      ],
    });

    await god.goto("/admin/setup/schedule");
    await god.getByLabel("Season").selectOption(String(SEASON));
    await god.getByRole("button", { name: "See what would change" }).click();
    await expect(god.getByText("2 games to add, 0 kickoffs to update")).toBeVisible();
    await expect(god.getByText("Week 1: 2 games to add")).toBeVisible();
    const before = await db.query(`select count(*) from games where season_year = $1`, [SEASON]);
    expect(Number(before.rows[0].count)).toBe(0); // nothing is written by looking

    await god.getByRole("button", { name: `Load the ${SEASON} schedule` }).click();
    await expect(god.getByText("Done. Added 2 games and updated 0 kickoffs.")).toBeVisible();
    const rows = (await db.query(`select result from games where season_year = $1`, [SEASON])).rows;
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.result === "pending")).toBe(true);

    await god.getByRole("button", { name: "See what would change" }).click();
    await expect(god.getByText(`The ${SEASON} schedule is already up to date.`)).toBeVisible();

    // ESPN down: a plain message.
    await setEspn({ mode: "down", games: [] });
    await god.getByRole("button", { name: "See what would change" }).click();
    await expect(god.getByRole("alert")).toContainText("couldn't reach ESPN");

    await god.context().close();
  } finally {
    await db.close();
  }
});
