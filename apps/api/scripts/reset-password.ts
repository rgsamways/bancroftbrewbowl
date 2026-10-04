import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } from "@bbb/shared";
import { auth } from "../src/auth.js";
import { db } from "../src/db/client.js";
import { account, session, user } from "../src/db/schema.js";

// Sets a new password for someone who is locked out. The password comes from the
// environment so it is never a visible command-line argument:
//   NEW_PASSWORD='...' pnpm --filter @bbb/api reset-password person@example.com
const email = process.argv[2];
const newPassword = process.env.NEW_PASSWORD;
if (!email || !newPassword) {
  console.error("Usage: NEW_PASSWORD='...' tsx scripts/reset-password.ts <email>");
  process.exit(1);
}
if (newPassword.length < MIN_PASSWORD_LENGTH || newPassword.length >= MAX_PASSWORD_LENGTH) {
  console.error(`The password must be at least ${MIN_PASSWORD_LENGTH} and fewer than ${MAX_PASSWORD_LENGTH} characters.`);
  process.exit(1);
}

const found = await db.query.user.findFirst({ where: eq(user.email, email) });
if (!found) {
  console.error(`No account found for ${email}. They need to sign in by link at least once first.`);
  process.exit(1);
}

const ctx = await auth.$context;
const hash = await ctx.password.hash(newPassword);
const existing = await db.query.account.findFirst({
  where: and(eq(account.userId, found.id), eq(account.providerId, "credential")),
});
if (existing) {
  await db.update(account).set({ password: hash }).where(eq(account.id, existing.id));
} else {
  await ctx.internalAdapter.linkAccount({ userId: found.id, providerId: "credential", accountId: found.id, password: hash });
}
await db.delete(session).where(eq(session.userId, found.id));

console.log(`Password reset for ${email}. They have been signed out everywhere.`);
process.exit(0);
