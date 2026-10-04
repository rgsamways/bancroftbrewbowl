# Brew Bowl v2: build plan

_Written 2026-10-04, once the mockups reached a build-ready state and Robin said he felt close to beginning the build. The order was decided by Claude at Robin's request ("I'll let you decide the entire build order"). Nothing below is started._
_ Each slice becomes its own OpenSpec change when its turn comes._

Read first: `docs/v2/V2_PLAN.md` (why), `docs/v2/mockups/index.html` (what it looks like, ~115 pages), `docs/ROLES_AND_RULES.md` (who can do what), `docs/BUILD_PLAN.md` (the architecture that already exists), and the memory notes for decisions.

## How releases work (Robin's rule: it goes live immediately, and he decides)

- No private review gate and no waiting on anyone else. When a slice is built and **verified by me** (typecheck, lint, tests, a real-Chrome walkthrough at 390 by 844 against the matching mockups, and a check on `staging`), I promote `staging` to `main` right away. Robin decides what ships and when.
- **Staging is still used, but as my own quick verification step**, not a waiting room. It exists so a broken slice is found before real users, not as a place for sign-off.
- **Every slice must leave the whole app working**, because it ships alone. Old and new screens coexist until the new ones replace them. No slice ships a half-redesigned app.
- **Schema changes are additive only** (new tables, new nullable columns). A bad release is undone by reverting the commit; nothing needs rolling back in the database.
- Each slice ends the repo's normal way: sync specs, archive the change, commit, push, verify production, update `openspec/ROADMAP.md`.
- Release the whole thing as **v2.0.0** (a git tag) once the last slice is live.

## Order, and why

The order puts what is risky or unseen first, what everything else depends on second, and what is optional last.

| # | OpenSpec change | Size | Schema | Why here |
| --- | --- | --- | --- | --- |
| 1 | `secure-pick-access` | S | none | A real security fix, independent of the redesign. Planned and valid already. It also proves the whole pipeline on a small change. |
| 2 | `v2-shell` | M | none | Everything else sits inside it: colours, fonts, icons, the bottom bar. |
| 3 | `e2e-smoke` | S | none | Because slices ship live, a few phone-width browser tests guard the main flows. |
| 4 | `password-sign-in` + `v2-signin` | M | none | Planned and valid already. The sign-in pages are the front door. |
| 5 | `pool-total` | S | 1 column | A tiny additive column the standings and the admin settings both need. |
| 6 | `v2-home-and-pick` | L | none | The heart of the player experience. |
| 7 | `v2-standings` | M | none | Ties, find a player, pool total. |
| 8 | `admin-activity-log` | M | 1 table | Must exist before admin actions are rebuilt, so they can write to it. |
| 9 | `v2-admin-steps` | L | none | The step-by-step admin: next step, results, new pool, announcement, wipeout. |
| 10 | `admin-confirmations` | M | 1 table | The "another admin confirms" rule. Needs 8 and 9. |
| 11 | `menu-and-music` | L | 2 to 3 tables | Public menu, music and the admin screens for them. |
| 12 | `from-the-brewery` | M | extends 1 table | Features, specials, announcements. Needs 11. |
| 13 | `v2-help-and-extras` | M | none | How to play, admin guide, table card, TV standings, install help, weekly recap. |
| 14 | `roles-and-rules` | M | 1 column, 1 table | Only if the owner wants to hand out parts of the work. Not needed for launch. |
| 15 | `v2-cleanup-and-release` | S | none | Remove the old sidebar and drawer, update the runbook and docs, tag v2.0.0. |

Size: S is a short session, M is about one session, L is two or more.

## The slices

### 1. `secure-pick-access` (planned)
Owner-only writes, picks hidden until the lock (admins see "picked" without the team), emails private. Already written in `openspec/changes/secure-pick-access` with tests that fail first. Ships to production as soon as verified. **Why first:** it is the only item that fixes a hole that exists today.

### 2. `v2-shell`
- New design tokens (copper `#c17a45`, dark neutrals), Inter, Lucide everywhere, replacing the Oswald and Poppins setup in `apps/dashboard/src/index.css`.
- New layout: header with the logo and avatar, a bottom tab bar (Home, Pick, Standings, Menu, plus Admin for admins), the public layout without a bar. Me is reached from the avatar.
- Replaces `Shell.tsx`, `Sidebar.tsx`, `RightPanel*.tsx` and `MobileNavContext.tsx`. **The old pages keep working inside the new shell** until their own slice restyles them. The right-hand help drawer goes.
- Mockups: any page, for the frame; `home.html` and `account.html` most.
- Done when: every existing route renders inside the new shell on a phone, the bar highlights correctly, and an admin sees the Admin tab and a player does not.

### 3. `e2e-smoke`
Promote the throwaway Playwright walkthroughs into the repo: sign in, join, pick, standings, admin results. They run at 390 by 844 and are part of "verified" for every later slice.

### 4. `password-sign-in` + `v2-signin`
- `password-sign-in` exactly as planned (password for everyone, 10 characters, no sign-up by password, no forgot-password flow, operator reset script). Its first tasks prove the library assumptions for better-auth 1.1.9 before anything depends on them.
- `v2-signin`: tabs, check-your-email with resend, link-problem page, the 19+ and drink-responsibly lines, the first-run page.
- Mockups: the sign-in group, `set-password*`, `change-password`, `first-run`, `join*`.

### 5. `pool-total`
One nullable column on `pools` (the pool total in cents), editable by an admin even while the rules are locked, shown on Standings with the line "Cash handled at the bar, not in this app." The app never touches money.

### 6. `v2-home-and-pick`
- Home: the hero for the entry that needs attention, a pool switcher, all the states (not picked, picked, locked, out, season over, no pools, added by the brewery) for survivor and pick 'em.
- Pick: team cards, used teams dimmed, the confirm bar for survivor, the double-pick week, tap to pick for pick 'em, the jump to the next unpicked game, locked and "not your entry" states.
- Lives are hidden everywhere (the `mulligans_allowed` setting stays).
- New API: one `GET /me/summary` returning, per entry, the pool, status, next lock time, picks made, rank and players left, so Home loads in one request on bad Wi-Fi. Countdowns use the server's time, not the phone's clock.
- Mockups: `home*`, `pick*`, `elimination`, `pick-eliminated`.

### 7. `v2-standings`
Survivor (alive and eliminated, find a player) and pick 'em (points leaderboard with shared ranks like "T4"), the pool total card, the pool switcher. Player counts and ranks come from the server.

### 8. `admin-activity-log`
A table `admin_activity` (who, what, which pool or item, when, and whether it affected the actor's own entry). Every existing admin route that changes standings or content writes a row, naming the signed-in admin explicitly (no database trigger, which is what left kerfy's log without a name). An Activity page for admins. Mockup: `admin-activity`.

### 9. `v2-admin-steps`
The admin tab bar (Next step, Results, Menu, Pools, More) and the admin home as one "next step" card. Guided flows: enter results one game at a time (with "Change" for corrections and the survivor warning), open a new pool, post an announcement. The roster, picks table (teams hidden until the lock), pool settings, delete a pool, wipeout. Mockups: the "Admin" groups.

### 10. `admin-confirmations`
A table `admin_requests`. A wipeout or status change that affects an admin's own entry becomes a request; another admin confirms or declines with an optional reason; confirming applies it; both steps appear in Activity. With only one admin it is allowed and flagged. Mockups: `admin-wipeout-self`, `admin-approval*`, `admin-next-*`.

### 11. `menu-and-music`
New tables for menu items (drinks and dishes, add-ons, sides, labels, available or out, optional price) and events (bands). Public read routes (no sign-in) for the menu and music, the Menu tab and public menu page, the admin Menu and Music screens and the add-an-item and add-music flows. **Needs a plan-mode design pass** for the tables before the change is written, per the repo's rule for schema changes. Mockups: `menu-*`, `admin-menu*`, `admin-events*`, `admin-step-item-*`, `admin-step-event-*`.

### 12. `from-the-brewery`
Extends the existing `promotions` table with a kind (announcement, featured item, special), an optional menu item and a schedule (days and times). Feature a drink or dish, add a special, write an announcement, show them on Home. **Not included:** any offer linked to standings or winning; that waits on the owner and AGCO. The four automatic offers (`canned_promotions`) are retired from the screens.

### 13. `v2-help-and-extras`
How to play, the admin guide, the table card with a real QR code, TV standings, add-to-home-screen help, the weekly recap card (this needs server numbers like players out and the most-picked team after the lock), the "Live this weekend" card.

### 14. `roles-and-rules` (only if wanted)
The `rules` list on users, role templates, the Admins screen, last-admin protection, invitations by email. See `docs/ROLES_AND_RULES.md`.

### 15. `v2-cleanup-and-release`
Delete the retired shell, update `docs/BUILD_PLAN.md`, `docs/HANDOFF.md` and the runbook, tag `v2.0.0`.

## Standing risks and how each is handled

- **better-auth is pinned at 1.1.9** (Tobi's is on 1.7). Every library assumption is proved by a test before the UI relies on it (first tasks of slices 1 and 4).
- **The deadline rule `per_game_kickoff` exists in settings but isn't implemented.** Locking is the first kickoff of the week everywhere, including the new visibility rule.
- **Time zones.** Kickoffs are shown in Eastern time; countdowns use server time.
- **Bar Wi-Fi.** One summary request for Home, no heavy images, nothing that needs animation or sound.
- **Real content.** The drink list, wine list and prices are entered by the owner's wife through the admin screens once they exist; nothing here waits on that.
- **Legal copy.** The 19+ line and "Please drink responsibly." are in the shell and sign-in. The pool total wording is chosen. Game-linked drink offers are deliberately not built.
- **Size.** About 115 mockup pages is a lot. Slices 6, 9 and 11 are the biggest; each can be split further if it grows.

## What I need from Robin along the way

- A go for each slice (I won't start the next without it).
- Real beer styles, strengths and which beers are seasonal, whenever convenient. They can wait until the menu screens exist.
- A decision, before slice 14, on whether to build the Admins screen at all.
