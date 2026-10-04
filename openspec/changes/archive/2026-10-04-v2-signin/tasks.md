## 1. Prove the library behavior

- [x] 1.1 In a scratch test against the real test database, request a link, open it twice and open an altered token on better-auth 1.1.9; record exactly where the second and bad opens redirect and with what error marker (and whether an explicit error callback option is needed); note the findings in design.md and verify the successful open still signs in

## 2. Public frame and sign-in page

- [x] 2.1 Add a `PublicPage` component (logo, name, children, the 19+ and drink-responsibly lines, no tab bar) with the v2 tokens; verify with `pnpm typecheck` and a 390 by 844 screenshot
- [x] 2.2 Restyle the sign-in page content to `signin.html` (title, helper text, button label, first-time line, typed email kept with a plain error on failure) without touching `password-sign-in`'s tabs; verify with a screenshot against the mockup and an e2e check that a failed send keeps the typed email

## 3. Check your email and link problem

- [x] 3.1 Build check-your-email with the address, "Resend link" on a 30 second wait showing the seconds left, and "Use a different email"; verify with an e2e check (fake clock) that Resend sends a second link only after the wait and that the different-email path returns to an editable field
- [x] 3.2 Build the "That link didn't work" page, shown to signed-out visitors when the callback carries the error marker found in 1.1, with "Email me a new link" prefilled from `sessionStorage`; verify with an e2e check that an already-used link shows it and that a valid link still signs in

## 4. First-run welcome

- [x] 4.1 Add the first-run welcome to `Home.tsx` for a signed-in person with no entries (greeting, three steps, joinable pools with one-tap join, empty-pools message), nothing shown while loading, unchanged for returning players; verify with a screenshot against `first-run.html` and an e2e check that joining replaces it with normal Home

## 5. Tests, verify and ship

- [x] 5.1 Update `e2e/sign-in.spec.ts` and `e2e/join-and-pick.spec.ts` for the new wording and screens and add specs for resend, link problem and first run; verify `pnpm test:e2e` passes
- [x] 5.2 Run `pnpm lint`, `pnpm typecheck` and `pnpm test` from the repo root and verify all pass
- [x] 5.3 Walk the flow in real Chrome at 390 by 844 against the local stack (ports 3011 and 5183 only) and on staging; record what was seen (Done in real Chrome at 390 by 844 against the local stack, with screenshots; the staging preview site cannot reach the staging API, so staging was not walked.)
- [x] 5.4 Update `openspec/ROADMAP.md`, sync specs, archive the change, and promote `staging` to `main`
