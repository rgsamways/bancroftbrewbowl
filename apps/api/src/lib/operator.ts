// The god-user: an account whose verified email is listed in OPERATOR_EMAILS (comma separated, set
// in the server environment). It is configuration, not data: there is no column and no screen, so
// nothing inside the app can grant or take the status away. Only a verified email counts, and the
// emailed sign-in link verifies it, so only whoever controls that inbox qualifies.

type UserLike = { email?: string | null; emailVerified?: boolean | null; isAdmin?: boolean | null };

/** The configured god-user addresses, lowercased. Read each time so tests can change them. */
export function operatorEmails(): string[] {
  return (process.env.OPERATOR_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Is this address on the god-user list? Used to protect the account (verified or not). */
export function isOperatorAddress(email: string | null | undefined): boolean {
  return Boolean(email) && operatorEmails().includes((email as string).trim().toLowerCase());
}

export function isOperatorUser(user: UserLike | null | undefined): boolean {
  if (!user?.email || user.emailVerified !== true) return false;
  return operatorEmails().includes(user.email.trim().toLowerCase());
}

/** An admin, or the god-user (who passes every admin check without needing the flag). */
export function isAdminUser(user: UserLike | null | undefined): boolean {
  return Boolean(user?.isAdmin) || isOperatorUser(user);
}
