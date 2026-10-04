import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { magicLink } from "better-auth/plugins";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./db/client.js";
import * as schema from "./db/schema.js";
import { entries } from "./db/schema.js";
import { sendEmail } from "./lib/email.js";

/**
 * Links any entries an admin created for this email before the person ever
 * signed in. Runs after both user creation (first-ever sign-in) and user
 * updates (e.g. changing their email to one that was already invited).
 */
async function claimInvitedEntries(user: { id: string; email: string }) {
  await db
    .update(entries)
    .set({ userId: user.id, invitedEmail: null, invitedName: null })
    .where(and(eq(entries.invitedEmail, user.email), isNull(entries.userId)));
}

/**
 * better-auth 1.1.9 has no switch to turn off password sign-up (its
 * `disabledPaths` option is typed but never read at runtime; proved in
 * password-sign-in task 1.1), so these paths are refused here instead. A password
 * can sign in an existing account but can never create one, and there is no
 * reset-by-email flow.
 */
const REFUSED_PATHS = ["/sign-up/email", "/forget-password", "/forget-password/callback", "/reset-password"];

export const passwordHook = createAuthMiddleware(async (ctx) => {
  if (REFUSED_PATHS.some((p) => ctx.path === p || ctx.path.startsWith(`${p}/`))) {
    throw new APIError("NOT_FOUND", { message: "Not found", code: "NOT_FOUND" });
  }
  if (ctx.path === "/change-password") {
    const body = ctx.body as { currentPassword?: unknown; newPassword?: unknown } | undefined;
    if (typeof body?.newPassword === "string" && body.newPassword === body.currentPassword) {
      throw new APIError("BAD_REQUEST", {
        message: "New password must be different",
        code: "NEW_PASSWORD_SAME_AS_CURRENT",
      });
    }
  }
});

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [process.env.DASHBOARD_URL ?? "http://localhost:5173"],
  // Only set in production, where the API and dashboard live on different
  // subdomains of the same domain — without this, better-auth scopes the
  // session cookie to the exact host that set it, so a cookie set by
  // api.bancroftbrewbowl.ca would never be sent back to bancroftbrewbowl.ca.
  advanced: process.env.COOKIE_DOMAIN
    ? { crossSubDomainCookies: { enabled: true, domain: process.env.COOKIE_DOMAIN } }
    : undefined,
  emailAndPassword: { enabled: true, minPasswordLength: 10 },
  hooks: { before: passwordHook },
  // The library only limits requests when NODE_ENV is "production", which Railway does
  // not set. Turn it on wherever the API runs on Railway (staging and production) so
  // password guessing is slowed: password sign-in allows 5 attempts per 10 seconds per client.
  rateLimit: {
    enabled: Boolean(process.env.RAILWAY_ENVIRONMENT_NAME) || process.env.NODE_ENV === "production",
    customRules: { "/sign-in/email": { window: 10, max: 5 } },
  },
  user: {
    additionalFields: {
      isAdmin: { type: "boolean", defaultValue: false, input: false },
    },
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async ({ newEmail, url }) => {
        await sendEmail(
          newEmail,
          "Confirm your new email — Bancroft Brew Bowl",
          `<p>Click below to confirm this is your new email address for Bancroft Brew Bowl:</p><p><a href="${url}">${url}</a></p>`
        );
      },
    },
  },
  databaseHooks: {
    user: {
      create: { after: claimInvitedEntries },
      update: { after: claimInvitedEntries },
    },
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendEmail(
          email,
          "Your Bancroft Brew Bowl sign-in link",
          `<p>Click below to sign in to Bancroft Brew Bowl:</p><p><a href="${url}">${url}</a></p>`
        );
      },
    }),
  ],
});
