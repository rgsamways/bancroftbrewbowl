# Brew Bowl v2 — "game-like" front-end, built the simple way

_Written 2026-10-02, at the end of the Tobi's Grab & Go session (`C:\dev\tobisgrabandgo`). Robin asked for this to be captured so a fresh session in this repo can start cleanly. Nothing here is built yet. The only artifact is a static mockup in `docs/v2/mockups/`._

## Read first

1. This file.
2. `docs/v2/mockups/home.png` (what Robin approved with "WOWOWOWOW, you nailed it") and `home.html` (its source: plain HTML/CSS, open in a browser).
3. `docs/BUILD_PLAN.md`, `docs/HANDOFF.md`, and this repo's `CLAUDE.md` (OpenSpec is required here; commit/push/deploy is pre-authorized for routine finishes; local → staging → production).

## Why v2

Robin tried the current site himself and is not happy with it. The back end (pools, picks, scoring, auth, schedule import) is considered sound. The problem is the experience. The goals he stated:

- **Much easier to use** than it is now: for the people who play the pool, and for the admin who runs it.
- **More "game-like" in look and feel.** Not a data-entry app for a spreadsheet; something that feels like playing.
- Follow **the ease and simplicity of the Tobi's Grab & Go project** (see "The playbook" below), and make the pools themselves easy for people to use.

Robin's exact words, in case nuance matters: *"if i wanted to rewrite the bancroftbrewbowl website to much easier to use than it is right now, could we follow the ease and simplicity we used in this project and still make pools that are easy for people to use?"* and *"the goal i'm after is to make it bit more game-like in look'n'feel."* He has not yet said which specific screens frustrated him. **Ask him**, then confirm by running the app and screenshotting every screen at phone width before deciding what to cut.

## Product, in one paragraph

NFL survivor and pick 'em pools for Bancroft Brewing Co. (a bar). Players get a magic-link sign-in, join a pool, pick weekly before the first kickoff of the week, and watch standings. An admin creates pools, invites people, enters results, resolves wipeouts, and posts promotions (free-text and four canned kinds). Template-per-client deployment (see `project_product_direction` memory): one deployment = one business. Dashboard on Vercel, API + Postgres on Railway.

## The playbook (what made Tobi's site easy, and should be repeated here)

This is the part Robin cares most about. It is a process and a set of habits, not just a stack.

**Process**
- One OpenSpec change per piece of work: proposal → delta specs with testable WHEN/THEN scenarios → design → tasks, each task ending in "verify X". Tasks are only ticked when the behaviour is actually verified. Archive and sync specs at the end.
- Small, shippable steps with a **checkpoint where Robin looks at it** before the next one (screenshots in chat). Don't run unattended end to end.
- **Mockup first, code second.** Robin approved the look from a static HTML picture before any real code. Keep doing this per screen (pick screen, standings, admin).
- Visual experiments stay local until Robin approves. (Here, push/deploy is pre-authorized for routine finishes, but a visual change he hasn't seen should not go to production unseen: use `staging` for that.)
- Logical commits, each one a complete working step.
- After a deploy, **verify production for real** (live HTML/API responses), not just "the deploy succeeded".

**Decide what NOT to build**
- Tobi's site stayed simple because features were refused: no public sign-up, no customer accounts, no settings that can be derived instead of stored (this repo already follows that for "current season"). Before building any screen, list the 5–6 things a *player* and the 5–6 things an *admin* actually do. Everything else is cut or hidden.
- Prefer deriving over storing (this repo's pick 'em points and "current season" already do).

**Phone-first, plain-English UX**
- Design for a phone in a bar first; desktop second. Big tap targets (≥44px), one primary action per screen.
- Friendly validation and honest errors in plain language, never raw codes; keep what the person typed when something fails.
- Anything destructive needs a clear confirm (this repo already has type-the-name delete for pools).
- Nothing mysterious: say what just happened ("Locked in!", "You are still alive") and what happens next.

**Verification habits**
- Pure logic lives in small, exhaustively tested modules (Tobi's `src/lib/*`: time zones, DST days, price rules). Here: scoring, lock times, "current week", lives, streaks, rank movement.
- Route tests against a real Postgres (already the setup here).
- **Real-Chrome walkthroughs with Playwright at phone width (390×844)** for each flow, screenshots reviewed by eye. Throwaway scripts were kept outside the repo in `C:\tmp\tobis-ui`; for v2, consider promoting a few into repo-level tests (listed as a gap in BUILD_PLAN: "Most routes still have no tests").
- Check responsive widths and "nothing overlaps / no sideways scroll" explicitly.
- Accessibility: check colour contrast on the dark theme (gold on near-black is fine; muted grey text and the dim "used team" cards need checking), real labels on inputs, `prefers-reduced-motion` respected for any animation.

**Documentation for the humans**
- A short guide for the admin (and a one-page "how to play" for players) written in the same plain voice, with phone screenshots, available **inside the app** and as a PDF. Tobi's was built from HTML via a Chrome print script (`C:\dev\tobisgrabandgo\docs\tools\build-docs.mjs`).
- Keep an "Optional, whenever convenient" list and a "What only <the owner> can give" list in the docs so nothing is forgotten.
- Keep a RUNBOOK of operator commands (seed, reset, loaders).

## v2 design direction (from the approved mockup)

Keep the existing brand: dark theme, copper/amber accent (`#c17a45` in the current `@theme`; the mockup pushes a brighter amber/gold `#e8a24d`/`#ffd27a` for glow), Oswald for headings/numbers, Poppins for body.

The mockup (phone homepage, see `mockups/home.png`) introduces:

- **Hero "status" card**: "YOU ARE STILL ALIVE" badge, big "Week N · Make your pick", pool name and "38 of 64 players left", **lives shown as beer mugs** (full/spent), **countdown tiles** (days/hours/mins) to the pick lock, and one chunky primary button ("Lock in my pick →").
- **Matchups as tap cards**: two team badges per game, the player's pick glowing gold with "YOUR PICK", already-used teams dimmed ("used wk 2"), kickoff time between, **crowd percentage** ("38% picked").
- **Leaderboard** with the viewer's row highlighted, win streaks, and rank movement arrows.
- **Bar promotion card** (existing Promotions feature, restyled) — "Tonight at the brewery".
- **Bottom tab bar**: Home · Pick · Standings · Me — replaces the current left sidebar + right help drawer on phones.
- All names, teams and numbers in the mockup are fictional.

Likely next design ideas Robin liked in principle ("game-like"): moments of delight (a "Locked in!" confirmation, elimination/wipeout drama screen, weekly recap cards), big-screen standings for the bar TV, restrained animation. Keep effects restrained; one cohesive palette does more than many effects.

## What the mockup needs from the back end (verify before promising)

| Mockup element | Source today | Gap |
| --- | --- | --- |
| Alive / eliminated | `entries.status` | none |
| Lives (mugs) | survivor rules `mulligans_allowed` and `entries.mulligans_used` | survivor only; decide what pick 'em shows instead (points + rank?) |
| "N of M players left" | count `entries` by status per pool | trivial query |
| Countdown to lock | `MIN(kickoffTime)` per season+week (derived) | none; compute client-side with the server time as the reference (the Tobi clock lesson: don't trust the device clock) |
| "Your pick" / used teams | `picks` | none |
| "% picked" | aggregate `picks` per game/week | new read endpoint; consider whether to reveal before lock (it can influence picks; maybe show only after lock) |
| Win streak | derive from `picks.result` | new derived value |
| Rank movement ▲▼ | needs previous-week standings | derive from picks/results as of the previous decided week; don't store |
| Promotions | existing | restyle only |

Hard rules to respect (from BUILD_PLAN "History worth knowing"): never store "current season"; `pools.type` is immutable; games are season-scoped, not pool-scoped; pick 'em points are derived, never stored; `@bbb/shared` needs a real build; pin pnpm.

## Proposed sequence (each an OpenSpec change, each with a Robin checkpoint)

0. **Explore (read-only):** run the app locally, screenshot every screen at phone width, list what players and the admin actually do, ask Robin where it frustrates him, and write the "cut list". Output: a short findings note appended to this file.
1. **Mockups for the remaining key screens** in the same style, before building: Pick screen (most important), Standings, Join/Login, Admin (pool setup + enter results + wipeout). Robin approves each.
2. **`v2-theme-and-shell`**: the new theme tokens, fonts, bottom tab bar, phone-first shell; retire the right-hand help drawer (replace with inline hints and a Help page). Keep old pages working underneath until replaced.
3. **`v2-home`**: the approved homepage, using real data (lives, countdown, matchups preview, leaderboard top, promotion).
4. **`v2-pick-screen`**: tap-a-team-card picking for survivor and pick 'em, with confirmation moment and clear lock/deadline states.
5. **`v2-standings`**: game-like standings (alive/eliminated, streaks, movement), per pool.
6. **`v2-admin-simplify`**: fewer clicks to run a week (enter results, resolve wipeouts), plain-English labels, hide unused settings.
7. **`v2-guide-and-docs`**: in-app guide + PDF, runbook, "how to play" page.
8. Delight pass (optional): confirmations, elimination/wipeout moments, recap cards, big-screen display mode.

Release as a **major version** (v2.0.0): tag it, and give the changes a staging soak (`staging` branch → preview + `api-staging`) before promoting `staging` → `main`.

## Open questions for Robin

1. Which exact screens/steps frustrated you most (sign-in, finding the pick screen, understanding standings, admin setup)?
2. Player first or admin first? (Assumed: player first.)
3. Does a "lives" concept make sense for pick 'em, or should its hero show points and rank instead?
4. Should "% picked" be hidden until the week locks (to avoid herding)?
5. Keep the beer-mug lives, or a different motif?
6. Is a big-screen/TV standings view wanted for the bar?
7. Is this repo still a template for future bars (affects how much brand is hard-coded vs configurable)?

## Practical notes for the next session

- Mockup source: `docs/v2/mockups/home.html` (self-contained; uses Google Fonts link; fixed bottom nav; max width 430px).
- Screenshot script pattern (Playwright with the installed Chrome, 390×844 @2x): see `C:\tmp\tobis-ui\mock-shot.mjs` (needs `playwright-core`, which lives in `C:\tmp\tobis-ui\node_modules`).
- Dev ports: API 3001, dashboard 5173, local Postgres 5437 (`pnpm docker:up`).
- Windows/Git Bash gotchas learned on the Tobi project: heredocs mangle apostrophes and `\n` in code; prefer the Edit/Write tools for code with escapes. `grep` of paths with `/c/…` works in bash but not from Windows Python; use `C:/…` there.
- Sibling project for reference of style and structure: `C:\dev\tobisgrabandgo` (single app, same tech family; its `CLAUDE.md`, `docs/tools/build-docs.mjs`, `openspec/changes/archive/*` show the process in practice).
