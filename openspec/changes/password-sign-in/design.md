## Context

Sign-in today is the email link only (see proposal.md for why we want a password as well). The pieces involved:

- `apps/api/src/auth.ts` configures better-auth **1.1.9** with the magic-link plugin and a hook that links invited entries when a user is created. It is mounted by `src/lib/auth-plugin.ts` under `/api/auth/*`. Authenticated routes use `requireSession` from `src/lib/guards.ts`.
- `apps/dashboard/src/pages/Login.tsx` is a single email field; `Account.tsx` has display name and email forms.
- The `account` table already has a `password` column (better-auth's credential accounts), so no migration is needed.
- Tobi's Grab & Go (`C:\dev\tobisgrabandgo`) is the reference. It runs better-auth **^1.7.6**, so its settings are a guide, not something to copy line for line.

Facts checked in the installed 1.1.9 package while planning this:

- `emailAndPassword` supports `enabled`, `minPasswordLength` (default 8), `maxPasswordLength` (default 128), `sendResetPassword`. It has **no `disableSignUp`** (only the magic-link and email-otp plugins do), so enabling it would, by itself, expose a public `/sign-up/email` endpoint.
- The top-level option `disabledPaths` exists and `hooks.before` takes a single handler built with `createAuthMiddleware` (exported from `better-auth/api`).
- `setPassword` exists but is marked `SERVER_ONLY`, so it is **not reachable through the HTTP handler**. `changePassword` is reachable and requires the current password.
- The auth context exposes `password.hash`, usable by an operator script.

## Goals / Non-Goals

**Goals:**
- A password is an optional extra for anyone with an account, set from the Me page, and never a way to create an account.
- Sign-in, set and change behave exactly as the spec and the mockups describe, with the same rules and wording on the server and in the browser.
- Locked-out people are never stuck: the link is always available, and an operator can reset a password.

**Non-Goals:**
- Email verification, two-factor sign-in, or a "forgot password" email flow.
- Upgrading better-auth. It stays at 1.1.9.
- Changing the link flow, sessions, or admin permissions.
- Showing or managing other people's passwords in the admin screens.

## Decisions

### 1. Turn on email and password, then close the doors we don't want
Set `emailAndPassword: { enabled: true, minPasswordLength: 10 }` and list `disabledPaths` for the endpoints that would otherwise exist: `/sign-up/email`, `/forget-password`, `/reset-password` and its token callback. A test posts to each and asserts it is refused and creates no user. If `disabledPaths` turns out not to cover a path, a `hooks.before` handler that rejects those paths is the fallback.
*Alternatives:* upgrade to a version that has `emailAndPassword.disableSignUp` (rejected: a major jump for an unrelated feature, with its own regressions to find); leave sign-up open (rejected: breaks "a password can never create an account").

### 2. First password goes through one small authenticated route
`POST /me/password` takes `{ newPassword }`, requires a session, validates against the shared rules, refuses with a clear code if the user already has a credential account, and otherwise calls the server-only `setPassword` with the request's headers. `GET /me/password` returns `{ hasPassword }` (does a credential account exist for this user), which the Me page and the password page use to choose "Set" or "Change".
*Alternatives:* making a first password go through `changePassword` with an empty current password (rejected: that endpoint verifies the current one and would fail); a database write that hashes by hand (rejected: bypasses the library for no gain).

### 3. Changing a password uses the library's endpoint, plus one guard
The dashboard calls the library's `changePassword` (current plus new). A `hooks.before` handler on `/change-password` rejects a new password equal to the current one with a stable code, because the library doesn't. This mirrors Tobi's.

### 4. One shared module for the rules and the words
`packages/shared/src/password-form.ts` holds the minimum, the validation (`current`, `next`, `confirm`) and a function that turns a failed request into a message next to the right field, with the exact copy from the spec. Both the API (for the first-password route) and the dashboard (instant feedback) import it. It follows Tobi's `password-form.ts`; the only intended difference is the mismatch wording used in the mockups. Library error codes in 1.1.9 are confirmed in tests, not assumed.

### 5. Sign-in page: tabs, not a second page
`Login.tsx` keeps one route. Two tabs share the typed email, so switching to "Email me a sign-in link instead" doesn't make the person retype. Link is the default tab. The password form uses `autoComplete="email"` and `"current-password"`; set and change forms use `"new-password"`. Any failure shows the single wrong-details message and leaves the fields filled.

### 6. Account page and one password page
`Account.tsx` gets the Password section driven by `hasPassword`. One new page, `/account/password`, renders the "set" form (new plus confirm) or the "change" form (current plus new plus confirm) depending on `hasPassword`, and a saved state. Admins see the same thing.

### 7. Operator reset script
`apps/api/scripts/reset-password.ts <email>` reads the new password from an environment variable (never as a visible argument), enforces the minimum, hashes it with the library's own hasher, writes the credential account (creating it if absent), and revokes that user's sessions, as Tobi's does. It prints a plain result and exits non-zero when no account matches. It sits next to the existing `make-admin.ts` and `seed-schedule.ts`.

## Risks / Trade-offs

- **Public sign-up left open by accident** → decision 1 plus a test for each closed path; also checked by hand on staging against the real deployed API.
- **Pinned old library behaves differently from Tobi's** (error codes, hooks shape, whether `change-password` revokes other sessions) → every library assumption above is checked by a test before the UI depends on it; any difference is noted in tasks.md and the code, not worked around silently.
- **Brute-force guessing** → rely on the library's built-in request limiting; confirm it applies to the sign-in path on staging and note the result. No custom limiter in this change.
- **People forget a password** → the link always works, so the cost is one extra tap. Deliberately no reset email flow.
- **`GET /me/password` reveals only whether the caller has a password** → it requires a session and returns nothing about anyone else.
- **Password managers and iOS autofill** need correct field names and `autoComplete` values → checked by hand on a real phone.

## Migration Plan

1. No database migration; nothing in `openspec` or `railway` needs to change.
2. Ship to the `staging` branch first. Check on the preview deployment: link sign-in unchanged, set a password, sign out, sign in with it, wrong password message, change it, direct sign-up request refused, reset script against the staging database.
3. Promote `staging` to `main` (pre-authorised for the routine finish).
4. Rollback is a revert of the commit. Accounts that set a password keep a credential row, which is inert once the feature is gone and does no harm.
