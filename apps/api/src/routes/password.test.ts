import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { auth } from "../auth.js";
import { db } from "../db/client.js";
import { account, user } from "../db/schema.js";
import { createUser } from "../test/fixtures.js";
import { actAs, buildTestApp, type TestActor } from "../test/route-harness.js";

// Route tests use the real route code and database, with only "who is signed in"
// replaced. The sign-in / change-password calls below go through the real library.
vi.mock("../lib/auth-plugin.js", () => ({ getSession: vi.fn(), authPlugin: async () => {} }));

const GOOD = "correct horse battery";
const ORIGIN = process.env.DASHBOARD_URL ?? "http://localhost:5173";
const API_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

type User = Awaited<ReturnType<typeof createUser>>;
const as = (u: User): TestActor => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin });

async function authCall(pathname: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await auth.handler(
    new Request(`http://localhost:3011/api/auth${pathname}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
      body: JSON.stringify(body),
    })
  );
  const text = await res.text();
  return {
    status: res.status,
    body: text ? (JSON.parse(text) as Record<string, unknown>) : {},
    cookie: (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "",
  };
}

const signIn = (email: string, password: string) => authCall("/sign-in/email", { email, password });

function runResetScript(email: string, password: string) {
  return spawnSync("pnpm", ["exec", "tsx", "scripts/reset-password.ts", email], {
    cwd: API_DIR,
    env: { ...process.env, NEW_PASSWORD: password },
    shell: true,
    encoding: "utf8",
  });
}

async function sessionIsValid(cookie: string, userId: string) {
  const res = await auth.handler(new Request("http://localhost:3011/api/auth/get-session", { headers: { cookie } }));
  return (await res.text()).includes(userId);
}

describe("password sign-in", () => {
  let app: FastifyInstance;
  const userIds: string[] = [];
  const emails: string[] = [];

  beforeAll(async () => {
    app = await buildTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(async () => {
    for (const id of userIds.splice(0)) await db.delete(user).where(eq(user.id, id));
    for (const email of emails.splice(0)) await db.delete(user).where(eq(user.email, email));
  });

  async function newUser() {
    const u = await createUser({ name: "Pat" });
    userIds.push(u.id);
    return u;
  }
  async function setFirstPassword(u: User, password = GOOD) {
    actAs(as(u));
    return app.inject({ method: "POST", url: "/me/password", payload: { newPassword: password } });
  }

  it("never creates an account from an email and password", async () => {
    const email = `signup-${crypto.randomUUID()}@example.com`;
    emails.push(email);
    const res = await authCall("/sign-up/email", { email, password: GOOD, name: "Nope" });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await db.query.user.findFirst({ where: eq(user.email, email) })).toBeUndefined();

    const unknown = await signIn(email, GOOD);
    expect(unknown.status).toBe(401);
    expect(await db.query.user.findFirst({ where: eq(user.email, email) })).toBeUndefined();
  });

  it("refuses password reset by email", async () => {
    const u = await newUser();
    expect((await authCall("/forget-password", { email: u.email, redirectTo: "/" })).status).toBe(404);
    expect((await authCall("/reset-password", { newPassword: GOOD, token: "x" })).status).toBe(404);
  });

  it("still sends a sign-in link as before", async () => {
    const u = await newUser();
    const res = await authCall("/sign-in/magic-link", { email: u.email, callbackURL: ORIGIN });
    expect(res.status).toBe(200);
  });

  it("GET /me/password needs a session and reports whether one is set", async () => {
    actAs(null);
    expect((await app.inject({ method: "GET", url: "/me/password" })).statusCode).toBe(401);

    const u = await newUser();
    actAs(as(u));
    expect((await app.inject({ method: "GET", url: "/me/password" })).json()).toEqual({ hasPassword: false });
    expect((await setFirstPassword(u)).statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/me/password" })).json()).toEqual({ hasPassword: true });
  });

  it("POST /me/password: signed out, too short and too long are refused", async () => {
    actAs(null);
    expect((await app.inject({ method: "POST", url: "/me/password", payload: { newPassword: GOOD } })).statusCode).toBe(401);

    const u = await newUser();
    expect((await setFirstPassword(u, "a".repeat(9))).statusCode).toBe(400);
    expect((await setFirstPassword(u, "a".repeat(128))).statusCode).toBe(400);
    actAs(as(u));
    expect((await app.inject({ method: "GET", url: "/me/password" })).json()).toEqual({ hasPassword: false });
  });

  it("a first password works at sign-in and cannot be set a second time", async () => {
    const u = await newUser();
    expect((await setFirstPassword(u)).statusCode).toBe(204);

    const ok = await signIn(u.email, GOOD);
    expect(ok.status).toBe(200);
    expect(ok.cookie).toContain("session_token");

    const again = await setFirstPassword(u, "another long password");
    expect(again.statusCode).toBe(409);
    expect(again.json().code).toBe("PASSWORD_ALREADY_SET");
    expect((await signIn(u.email, GOOD)).status).toBe(200);
  });

  it("stores a hash, not the password", async () => {
    const u = await newUser();
    await setFirstPassword(u);
    const rows = await db.select().from(account).where(eq(account.userId, u.id));
    expect(rows[0]?.password).toBeTruthy();
    expect(rows[0]?.password).not.toContain(GOOD);
  });

  it("gives the same answer for a wrong password, an unknown email and an account with no password", async () => {
    const withPw = await newUser();
    await setFirstPassword(withPw);
    const noPw = await newUser();
    const results = [
      await signIn(withPw.email, "wrong password here"),
      await signIn(`nobody-${crypto.randomUUID()}@example.com`, GOOD),
      await signIn(noPw.email, GOOD),
    ];
    for (const r of results) {
      expect(r.status).toBe(401);
      expect(r.body.code).toBe("INVALID_EMAIL_OR_PASSWORD");
      expect(r.cookie).toBe("");
    }
    expect(results[1]?.body).toEqual(results[0]?.body);
    expect(results[2]?.body).toEqual(results[0]?.body);
  });

  it("changing a password needs the right current one and a different new one", async () => {
    const u = await newUser();
    await setFirstPassword(u);
    const { cookie } = await signIn(u.email, GOOD);
    const change = (currentPassword: string, newPassword: string) =>
      authCall("/change-password", { currentPassword, newPassword }, { cookie });

    const wrong = await change("not my password", "a brand new password");
    expect(wrong.status).toBe(400);
    expect(wrong.body.code).toBe("INVALID_PASSWORD");

    const same = await change(GOOD, GOOD);
    expect(same.status).toBe(400);
    expect(same.body.code).toBe("NEW_PASSWORD_MUST_BE_DIFFERENT");

    const short = await change(GOOD, "short");
    expect(short.body.code).toBe("PASSWORD_TOO_SHORT");

    expect((await change(GOOD, "a brand new password")).status).toBe(200);
    expect((await signIn(u.email, "a brand new password")).status).toBe(200);
    expect((await signIn(u.email, GOOD)).status).toBe(401);
  });

  it("the reset script fails for an unknown email and for a short password", () => {
    const missing = runResetScript(`nobody-${crypto.randomUUID()}@example.com`, GOOD);
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain("No account found");
    expect(runResetScript("x@example.com", "short").status).not.toBe(0);
  }, 60_000);

  it("the reset script replaces a password and ends existing sessions", async () => {
    const u = await newUser();
    await setFirstPassword(u);
    const { cookie } = await signIn(u.email, GOOD);
    expect(await sessionIsValid(cookie, u.id)).toBe(true);

    const res = runResetScript(u.email, "reset by the operator");
    expect(res.status).toBe(0);

    expect((await signIn(u.email, "reset by the operator")).status).toBe(200);
    expect((await signIn(u.email, GOOD)).status).toBe(401);
    expect(await sessionIsValid(cookie, u.id)).toBe(false);
  }, 60_000);
});
