## 1. Prove the library assumptions first

- [x] 1.1 In a scratch test against the real test database, confirm on better-auth 1.1.9 that enabling email and password with `disabledPaths` for `/sign-up/email`, `/forget-password` and `/reset-password` refuses a direct sign-up request and creates no user; record the exact path names that work (and add a `hooks.before` rejection only if any path is not covered)
- [x] 1.2 In the same scratch test confirm what the library's change-password endpoint, the server-only set-password call and the sign-in endpoint return for: wrong password, no password set, unknown email, password too short and too long; write the real error codes into a comment in the shared module's task (2.1) so nothing is guessed
- [x] 1.3 Confirm whether the library's built-in request limiting covers the password sign-in path, and whether changing a password signs out other sessions; note both findings in design.md under Risks

## 2. Shared rules and wording

- [x] 2.1 Add `packages/shared/src/password-form.ts` (minimum 10, maximum 128, validation of current/new/confirm, and a function turning a failed request into a message beside the right field using the exact copy in the spec) and export it from the package index; verify with `pnpm typecheck`
- [x] 2.2 Add unit tests for every message in the spec (too short, too long, mismatch, same as current, wrong current, network, session ended, wrong sign-in details) and verify `pnpm test` passes

## 3. API

- [x] 3.1 In `apps/api/src/auth.ts` enable email and password with the 10 character minimum, add the `disabledPaths` confirmed in 1.1, and add a `hooks.before` handler on the change-password path that rejects a new password equal to the current one; verify the existing sign-in link flow still works with an integration test
- [x] 3.2 Add `GET /me/password` (session required, returns `{ hasPassword }`) and `POST /me/password` (session required, shared-rules validation, refuses with a stable code if a password already exists, otherwise sets it); verify with route tests covering signed out, already set, too short and success
- [x] 3.3 Add integration tests proving: a password user signs in; a wrong password, an unknown email and a no-password account all return the same failure; a direct sign-up request creates no account; a password reset by email request is refused; changing a password works with the right current one and fails with the wrong one
- [x] 3.4 Add `apps/api/scripts/reset-password.ts` (email as an argument, new password from an environment variable, minimum enforced, credential account created if missing, that user's sessions revoked, clear message when no account) and a `package.json` script; verify by resetting a password in a test database and then signing in with it, and that an unknown email exits non-zero

## 4. Dashboard

- [x] 4.1 Rework `Login.tsx` into two tabs (Email link default, Password) that share the typed email, with the password form, "Email me a sign-in link instead", the single wrong-details message, field attributes for password managers, and the 19+ and drink-responsibly lines from the mockups; verify with `pnpm typecheck` and a Playwright walk at 390 by 844 that screenshots match `signin.html`, `signin-password.html` and `signin-password-error.html`
- [x] 4.2 Add the Password section to `Account.tsx` driven by `GET /me/password`, and the `/account/password` page with its set form, change form and saved state, using the shared rules for instant feedback; verify with a Playwright walk that screenshots match `set-password.html`, `set-password-error.html`, `change-password.html` and `password-saved.html`, and that failures keep what was typed
- [x] 4.3 Show the saved state and return to Me, and make sure signing out and back in with the new password works end to end in the browser; verify in the same Playwright walk

## 5. Verify and ship

- [x] 5.1 Run `pnpm lint`, `pnpm typecheck` and `pnpm test` from the repo root and verify all pass
- [x] 5.2 Push to the `staging` branch and, on the staging preview and `api-staging`, walk through: link sign-in unchanged, set a password, sign out, sign in with it, wrong password message, change it, a direct sign-up request refused, and the reset script against the staging database; record what was seen
- [ ] 5.3 On a real phone, confirm the password manager offers to fill and save the password and the keyboard shows an email layout on the email field
- [ ] 5.4 Add the new sign-in options to the admin runbook or docs (how a locked-out person is helped, how to run the reset script), update `openspec/ROADMAP.md`, then sync specs, archive the change, and promote `staging` to `main`
