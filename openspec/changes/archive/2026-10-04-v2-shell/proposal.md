## Why

The app's frame (a left sidebar that becomes a drawer on phones, a top bar with a hamburger and a help button, and a resizable help drawer on the right) was built for a desktop dashboard. v2 is for a phone in a bar, one-handed, so the frame has to change before any screen can. Every later slice sits inside it, so it goes first and has to leave the whole app working.

## What Changes

- **A new frame.** A slim header (the B logo, "Brew Bowl", and an avatar that opens Me) and a fixed bottom tab bar replace the sidebar, the mobile top bar and the help drawer.
- **Tabs:** Home, Pick, Standings, and for admins an Admin tab. Menu is added when the menu exists (a later slice). Me is reached from the avatar.
- **New look, all pages.** The colour tokens become the v2 ones (copper accent, dark neutrals, a flat dark background) and the font becomes Inter. Existing pages keep their own layouts and simply pick up the new colours and font until their own slice redoes them.
- **Tabs that lead somewhere.** There is no single "pick" or "standings" page today (they exist per pool). Two small interim pages, `/pick` and `/standings`, take a player to the right place: straight there with one pool, a short list with several, a "join a pool" message with none. A later slice replaces them.
- **Nothing becomes unreachable.** The sidebar was the only link to Schedule and Promotions, so an interim sub-navigation (Pools, Schedule, Promotions) appears on admin pages. The sidebar also held Sign out, so the Account page gets a Sign out button.
- **Retired:** the sidebar, the mobile top bar, the right-hand help drawer (and its per-page help text), and the contexts that drove them. Plain-English help comes back later as inline hints and a How to play page.
- The Admin tab is a display convenience. Admin pages and routes are still enforced by the server.
- No API change and no database change.

## Capabilities

### New Capabilities
- `app-shell`: the frame every signed-in screen sits in: header, bottom tabs and which tabs a person sees, where each tab leads, the colours and font, and what stays reachable.

### Modified Capabilities
<!-- None. The project's only main spec is pick-access, which this does not touch. -->

## Impact

- **Dashboard** (`apps/dashboard`): `src/index.css` (tokens), `index.html` (font), `src/components/Shell.tsx` (rebuilt), new header and bottom-bar components, a small tested module for tab logic in `src/lib/`, two new interim pages and routes in `App.tsx`, a Sign out button in `src/pages/Account.tsx`. Removed: `Sidebar.tsx`, `RightPanel.tsx`, `MobileNavContext.tsx`, `RightPanelContext.tsx`, and the help text in `src/lib/nav.ts`.
- **API / database:** none.
- **Verification limit:** the staging preview site cannot call the staging API (the staging API has no `DASHBOARD_URL` set), so the screens are verified with a real-Chrome walkthrough at phone width against the local stack plus a production build, and a public-page check after release. Fixing staging is a separate job.
- **Risk:** every screen changes at once in colour and font, so contrast and layout on the old pages are checked by eye in the walkthrough. A bad release is a revert; there is no data change to undo.
