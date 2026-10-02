# Session Handoff

_Written 2026-10-02, end of session. If you're reading this significantly later, treat the specifics below as a snapshot, not live truth — check git log and the live site first._

## Start here

This session is picking up **v2 work** (a major, "game-like," phone-first front-end rewrite). Read, in order:

1. This file.
2. `docs/v2/V2_PLAN.md` — the full plan, written at the end of a prior session. It has the "why," the legal guardrails, the approved mockup description, the proposed 8-9 step sequence, and open questions for Robin.
3. `docs/v2/mockups/home.png` (and `home.html`, the source) — the one approved mockup so far. Dark theme, copper/amber accent, footballs for "lives," bottom tab bar (Home/Pick/Standings/Me). Robin's reaction: "WOWOWOWOW, you nailed it." Nothing else has been mocked up yet.
4. `docs/BUILD_PLAN.md` — architecture/data model/feature reference, still accurate.
5. This project's memory at `C:\Users\rgsam\.claude\projects\c--dev-bancroftbrewbowl\memory\` — `project_v2_gamelike_frontend.md` has the legal guardrails and today's pot-feature decision (see below); don't re-derive either from scratch.

## Where things actually stand right now

- `main` is clean, pushed, nothing in flight. Last commits: `e5289e6` (v2 plan + legal guardrails) and `31af972` (v2 plan + approved mockup) — **no v2 code exists yet, planning only.**
- Production (`bancroftbrewbowl.ca` / `api.bancroftbrewbowl.ca`) is live and healthy, verified this session.
- There's also a `staging` branch/environment now (added the session before this one — see `openspec/changes/archive/2026-09-27-staging-environment` and `CLAUDE.md`'s Deploy pipeline section). Use it for any visual v2 work before Robin's seen it — v2 is exactly the kind of change that shouldn't go to production unseen.
- The still-unresolved scoring backlog from two sessions ago (no game results entered in production for a while, so eliminations/points weren't running) — status not rechecked this session. Worth a quick look if it comes up, but Robin explicitly said not to worry about it ("no one is using this project").

## Decisions made this session (not yet built)

1. **v2 direction confirmed.** Robin wants the game-like phone-first rewrite from `V2_PLAN.md`. Scope estimate given: 8-9 checkpointed OpenSpec changes (explore → mockups for remaining screens → theme/shell → home → pick screen → standings → admin simplification → docs/guide → optional delight pass), realistically multiple sessions if the checkpoint discipline is kept — and it should be kept; skipping it is what made the *previous* session (Railway/staging infra) feel endless and confusing to Robin.
2. **Legal stance reconfirmed, no change**: no money, no alcohol tied to play, bragging-rights-only rewards — this was already locked in last session and still stands.
3. **New idea, decided against as proposed**: Robin asked about a $5/week buy-in pot with a real Stripe integration to collect/pay it out. Advised against building this — a business collecting entry money and paying out a prize pool through its own payment processor reads as operating an unlicensed betting scheme under the Criminal Code (Bancroft is AGCO-licensed in Ontario; this risks the liquor license too), and separately Stripe's own terms restrict gambling/betting as a category. **Do not build Stripe/real-money payment features for this without Robin confirming he's gotten real legal advice first.**
4. **What Robin approved instead**: a **display-only pot feature**. Admin types in a cash figure (money collected informally at the bar, exactly as today — the app never touches payment), the app just displays the number somewhere exciting (home screen / standings, fits naturally into the v2 mockup direction). No Stripe, no payment rails, no payout logic — ever, for this. **Not yet built** — I'd gotten as far as checking `apps/api/src/db/schema.ts`'s `pools` table (no pot field exists yet) before this session ended. Smallest correct shape is probably a new nullable field on `pools` (e.g. `potAmountCents` or similar — decide the exact name/units), admin-editable via the existing pool settings modal, shown read-only to players. Scope this as its own small OpenSpec change — it's schema-touching, so it needs one per `CLAUDE.md`'s policy, but it's small enough to not need much ceremony.

## Open question still waiting on Robin

From `V2_PLAN.md`'s "Open questions" list — **this one blocks step 1 (mockups) of the v2 sequence**, though step 0 (explore) can start without it:

> Which exact screens/steps frustrated you most (sign-in, finding the pick screen, understanding standings, admin setup)?

Ask directly, or do `V2_PLAN.md`'s step 0 yourself first (run the app, screenshot every screen at phone width, form an independent view) and bring findings to him rather than asking blind.

## Practical reminders (unchanged from before, still true)

- `pnpm install && pnpm docker:up && cp .env.example apps/api/.env && pnpm db:migrate && pnpm dev:api && pnpm dev:dashboard` for local dev (API :3001, dashboard :5173, Postgres :5437).
- Both Vercel and Railway are git-connected — push to `main` deploys both automatically, migrations run automatically via Railway's `preDeploy` step. No manual `railway up`/`railway ssh` needed anymore.
- `packages/shared` must be built before `apps/api`/`apps/dashboard` resolve correctly — `pnpm typecheck`/`pnpm test` handle this automatically now via a `pretypecheck`/`pretest` hook; don't reintroduce the old "forgot to build shared" failure mode.
- Don't store "current season." `pools.type` is immutable. `games` are season-scoped, not pool-scoped. All still true, all still load-bearing — see `BUILD_PLAN.md`'s History section for why.
- OpenSpec is mandatory for non-trivial changes here (`CLAUDE.md`) — propose → design → tasks → apply → archive, with real verification per task, not just "written."
