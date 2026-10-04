import type { Browser, Page } from "@playwright/test";
import { API_URL, WEB_URL } from "../env";
import type { TestDb } from "./db";

/**
 * Sign in the way a player does: ask for a magic link, then open it. Local email only
 * logs a subject, so the one-time token is read from the verification table
 * (better-auth 1.1.9 stores it in plain text as `identifier`).
 */
export async function signIn(browser: Browser, db: TestDb, email: string, callbackPath = "/"): Promise<Page> {
  const res = await fetch(`${API_URL}/api/auth/sign-in/magic-link`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: WEB_URL },
    body: JSON.stringify({ email, callbackURL: WEB_URL + callbackPath }),
  });
  if (!res.ok) throw new Error(`magic link request failed for ${email}: ${res.status} ${await res.text()}`);

  const { rows } = await db.query(`select identifier from verification where value like $1 order by created_at desc limit 1`, [`%${email}%`]);
  if (!rows[0]) throw new Error(`no verification token found for ${email}`);

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await page.goto(`${API_URL}/api/auth/magic-link/verify?token=${rows[0].identifier}&callbackURL=${encodeURIComponent(WEB_URL + callbackPath)}`);
  await page.waitForSelector("header");
  return page;
}
