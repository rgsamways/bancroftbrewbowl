import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client.js";
import { user } from "../src/db/schema.js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: tsx scripts/make-admin.ts <email>");
  process.exit(1);
}

const [updated] = await db
  .update(user)
  .set({ isAdmin: true })
  .where(eq(user.email, email))
  .returning();

if (!updated) {
  console.error(`No user found with email ${email}. They need to sign in via magic link at least once first.`);
  process.exit(1);
}

console.log(`${email} is now an admin.`);
process.exit(0);
