## Why

Today the only way into Brew Bowl is an emailed link, which means leaving the page, finding the email, and tapping back, on bar Wi-Fi, every time the session ends. The v2 plan makes sign-in in the room a top priority. An optional password gives regulars a one-step sign-in on their own phone without removing the link, which stays the way accounts are created and the way anyone recovers.

## What Changes

- Players and admins can **optionally set a password** from the Me page and then sign in with email and password.
- The **email link stays the default** and the only way to create an account. A password can never create an account.
- The sign-in page gets two tabs, "Email link" (default) and "Password", with a "Email me a sign-in link instead" fallback on the Password tab and plain-English errors.
- The Me page gets a **Password** section: "Set a password" for people who have none, "Change password" (asks for the current one) for people who do.
- **No self-serve "forgot password" flow.** Forgetting a password is covered by signing in with a link. An operator script resets a password for someone who is locked out of their email-less workflow (mirrors Tobi's Grab & Go).
- Minimum password length is **10 characters**, the same as Tobi's Grab & Go.
- No database migration: better-auth's existing `account` table already has a `password` column.

## Capabilities

### New Capabilities
- `password-sign-in`: optional email and password sign-in alongside the email link, including how a first password is set, how it is changed, what is refused (sign-up by password, short or unchanged passwords), and what the player sees in each case.

### Modified Capabilities
<!-- None. The project has no main specs yet, so the existing email-link sign-in is not
     specified anywhere. It is restated inside the new spec as behavior that must not
     change. -->

## Impact

- **API** (`apps/api`): `src/auth.ts` (enable email and password with a 10 character minimum, disable the password sign-up and password-reset paths, block reusing the current password), a new authenticated route to set a first password, a new operator script to reset a password, new tests.
- **Dashboard** (`apps/dashboard`): `src/pages/Login.tsx` (tabs, password form, errors), `src/pages/Account.tsx` (Password section), new set-password and change-password pages, a shared password-rules module for instant feedback.
- **Shared** (`packages/shared`): the password rules and messages, so the API and the dashboard agree.
- **Dependencies:** none new. better-auth stays pinned at 1.1.9 (Tobi's is on a much newer version, so settings are adapted, not copied).
- **Design:** the screens are mocked in `docs/v2/mockups/` (`signin.html`, `signin-password.html`, `signin-password-error.html`, `set-password.html`, `set-password-error.html`, `change-password.html`, `password-saved.html`, plus the Password section on `account.html` and `account-admin.html`).
- **Risk:** this changes who can get a session, so it is verified by tests against a real database and a manual run on staging before production. No schema migration, so a rollback is a code revert.
