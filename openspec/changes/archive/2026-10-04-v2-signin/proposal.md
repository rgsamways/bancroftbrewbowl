## Why

The sign-in pages are the front door, and today they are plain: a bare email box, a "Check your email" dead end with no way to resend, and no friendly page if an emailed link has expired. A brand-new player also lands on a thin Home with no hint of what to do next. On bar Wi-Fi, in the room, with a phone in one hand, this is where people give up.

## What Changes

- Every page shown before sign-in gets the **v2 look**: the logo and name at the top, no tab bar, and the lines "You must be 19 or older to play." and "Please drink responsibly."
- The **sign-in page** is restyled to match `signin.html` (headline, helper text, "Email me a sign-in link", "First time here? Same thing. Your account is created when you tap the link.").
- **Check your email** shows the address back, a **Resend** button (with a short wait between sends), and "Use a different email".
- A new **"That link didn't work"** page is shown when an emailed link is expired or already used, with "Email me a new link".
- A first-time player (signed in, in no pool yet) sees the **first-run welcome** on Home: a greeting, three "How it works" steps and the pools they can join with one tap (`first-run.html`).
- Browser tests in `e2e/` are updated for the new screens.
- Out of scope: the Email link / Password tabs and the password forms (those are `password-sign-in`), the join-a-pool pages with the display-name line (slice 6, `v2-home-and-pick`), and anything that changes how links or sessions work.

## Capabilities

### New Capabilities
- `sign-in-experience`: what a signed-out or brand-new person sees and can do: the sign-in page, check-your-email with resend, the link-problem page, the 19+ and drink-responsibly lines, and the first-run welcome.

### Modified Capabilities
<!-- None. app-shell covers signed-in screens only; these pages are outside it. -->

## Impact

- **Dashboard** (`apps/dashboard`): `src/pages/Login.tsx` restyled and split into small pieces (public page frame, check-your-email, link-problem), `src/App.tsx` (show the link-problem page when signed out and the link failed), `src/pages/Home.tsx` (first-run welcome only when the person has no entries).
- **API** (`apps/api`): possibly an error-callback setting so a bad link lands on the link-problem page. Confirmed first in the task list; no new routes expected. No schema change.
- **Tests:** `e2e/sign-in.spec.ts` and `e2e/join-and-pick.spec.ts` updated, new specs added.
- **Ordering:** applied **after** `password-sign-in`, which owns the tabs on the same `Login.tsx`. This change must not remove or reshape them.
- **Design:** `signin.html`, `link-problem.html`, `first-run.html` in `docs/v2/mockups/`.
- **Risk:** the sign-in page is the only way in, so it is verified in a real browser against a local stack before it ships. No schema change, so rollback is a revert.
