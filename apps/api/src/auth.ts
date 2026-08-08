import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
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
