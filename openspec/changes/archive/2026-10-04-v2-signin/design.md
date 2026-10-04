## Context

`Login.tsx` is one component with an email box and a sent-state. Tabs and the password form are added to the same file by `password-sign-in`, which must land first. Magic links come from better-auth **1.1.9**'s magic-link plugin; today `callbackURL` is the dashboard origin. Signed-out visitors get `<Login />` for every URL (`App.tsx`), so there are no signed-out routes yet. Home already lists joinable pools and a Join button (`JoinPoolRow`); it has no first-run state. See proposal.md for the why.

## Goals / Non-Goals

**Goals:**
- Match the sign-in, link-problem and first-run mockups at 390 wide.
- A bad link ends on a clear page, not a dead end.
- No change to how links, sessions or accounts work.

**Non-Goals:**
- Tabs and password forms (`password-sign-in`).
- Join-a-pool detail pages, the display-name line, or the full Home redesign (slice 6).
- Rate limits, email wording or new email templates.

## Decisions

- **Small public-page frame component.** One `PublicPage` (logo, name, content, the two legal lines) used by sign-in, check-email and link-problem. Alternative: copy the header into each page. Rejected: three copies drift.
- **Link errors via the callback.** better-auth's magic-link verify redirects with an error marker on the callback URL when a token is bad. The app reads it on load, shows the link-problem page, and clears it from the address. The exact parameter, and whether 1.1.9 needs an explicit error callback, are proved first in the tasks (1.1) so nothing is guessed. Alternative: a custom verify route. Rejected unless 1.1.9 gives no usable error.
- **No router for signed-out pages.** `App.tsx` shows `Login` for every signed-out URL; it will pick link-problem when the error marker is present and otherwise keep showing sign-in.
- **Resend wait is client-side, 30 seconds.** It stops accidental double taps; real abuse limiting stays with the library. The email is kept in memory and in `sessionStorage` so "Email me a new link" can prefill it. Alternative: a server timer. Rejected: more moving parts for no gain.
- **First-run is a state of Home, not a new route.** Shown once the entries request has returned empty; reuses the existing pools list and `JoinPoolRow`, restyled. The "Shown to other players" name line is left to slice 6 because pools use the account name today.
- **Old Home sections stay for returning players.** Only the empty state changes, so the app keeps working until slice 6.

## Risks / Trade-offs

- [Library does not mark bad links the way assumed] → prove it in a scratch test first (task 1.1); fall back to a thin verify route only if needed.
- [Merge friction with `password-sign-in` on `Login.tsx`] → apply after it; leave tabs untouched and cover both in the same e2e spec.
- [Welcome flashes before entries load] → render nothing until the request returns.
- [Someone an admin invited sees the welcome] → invited entries are claimed when the account is created, so they already have entries and see normal Home.

## Migration Plan

No data change. Ship by the normal staging then main path; roll back by reverting the commit.

## Findings from task 1.1 (better-auth 1.1.9)

- A valid link redirects to the callback URL with a session cookie. A second use, or a bad token, redirects to `<callbackURL>?error=INVALID_TOKEN` with no cookie. No explicit error callback or custom verify route is needed; the app reads and clears `?error=` on load.
- better-auth's client can report a dropped connection as neither data nor error, so "sent" means the service answered with data.
- React runs initial state twice in development, so the marker is read once at module load.
