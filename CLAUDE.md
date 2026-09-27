# Bancroft Brew Bowl — project instructions

## OpenSpec workflow (required, not optional)

This project uses OpenSpec (CLI, spec-driven schema, `openspec/` at repo root)
for all non-trivial development, matching how Robin runs other projects
(kerfy, noisefloor, vocare, etc.) — don't treat it as optional ceremony, and
don't quietly fall back to freehand edits + hand-rolled markdown just because
a task feels well-understood already.

**Before starting any non-trivial change** (new feature, schema change,
permission/behavior change, anything touching more than a couple of files) —
create or update a real OpenSpec change first, using the installed skills
(`.claude/skills/openspec-*`), not hand-written files imitating their shape:

- **New work**: `openspec-propose` — scaffolds `proposal.md`, `design.md`,
  `specs/<capability>/spec.md`, and `tasks.md` together via the CLI.
- **Revising an in-flight change's plan**: `openspec-update-change`.
- **Implementing**: `openspec-apply-change` — works through `tasks.md`,
  checking items off as they're actually verified (not just written).
- **Thinking something through before committing to a change**:
  `openspec-explore` — read-only investigation and design discussion; never
  writes code.
- **Finishing a change**: `openspec-sync-specs` to merge its delta specs into
  the main specs, then `openspec-archive-change` once implementation and
  verification are both complete.

Use `openspec list --json` / `openspec status --change <name> --json` to check
real state before assuming what's done — don't rely on memory of a prior
session's summary, which can drift from what's actually in `tasks.md`.

**Small, truly mechanical fixes** (a typo, a one-line bug fix, a config value)
don't need a proposal — use judgment. Default to "yes, this needs a change"
for anything touching schema, routes, permissions, or user-facing behavior.
Schema-touching changes have historically gone through a plan-mode design
pass here even before OpenSpec was installed — keep doing that within the
`openspec-propose` step, not instead of it.

**`openspec/ROADMAP.md`** is the living, cross-change tracker — the
big-picture "where do things actually stand across every change" view Robin
reads to follow along. Keep it current whenever a change's status changes,
not only when asked directly.

## Read before making changes

`docs/BUILD_PLAN.md` is the comprehensive architecture/feature/data-model
reference; `docs/HANDOFF.md` is the latest session snapshot. Read both before
touching anything non-trivial — don't rediscover the architecture from
scratch. Persistent cross-session memory also exists at
`C:\Users\rgsam\.claude\projects\c--dev-bancroftbrewbowl\memory\`.

## Deploy pipeline (automatic, not a per-change ask)

There is no staging environment for this project — it's local → production
directly. Once a change's tasks are implemented and verified (typecheck/
build passes, and manually confirmed where practical), **archive it, commit,
push, and deploy as the normal last step — don't stop to ask permission for
commit/push/deploy on this repo specifically; that's pre-authorized here.**
Still surface what you're about to do before doing it, and stop and ask
first for anything actually destructive (force-push, `railway`/`vercel`
resource deletion, schema rollback) — the pre-authorization covers the
routine finish-a-change sequence only, not those.

- **Dashboard (Vercel)**: git-connected — auto-deploys on push to `main`, no
  manual step. Confirmed via `vercel project ls` after pushing if you want to
  double check a deploy actually fired.
- **API (Railway)**: **not** git-connected — pushing to git does nothing to
  it. Run `railway up --service api` right after pushing whenever a commit
  touches `apps/api` or `packages/shared` (the API's build depends on
  shared's compiled output). Skip it for dashboard-only or docs-only commits.
- **Schema changes**: `pnpm db:generate` → commit the migration → push →
  `railway up --service api` → `railway ssh --service api -- pnpm --filter
  @bbb/api db:migrate`. The migrate step is **not** automatic — never run a
  production migration without calling it out first, even though the rest of
  the pipeline is pre-authorized.
- Learned from `noisefloor` (same manual-Railway pattern): changing a
  Railway env var alone triggers a redeploy that reuses the **existing**
  build — it does not pull new code. If both code and an env var changed,
  you need `railway up` too, not just the variable set.
- State plainly whether a change is "done locally," "pushed," or "deployed"
  once you've finished the sequence — don't let "done" be ambiguous.

## Pace

Don't start any of the deferred/open-thread items in `docs/HANDOFF.md`
unprompted — every feature in this project so far went through an explicit
ask, often with a plan-mode design pass for schema-touching work, before
implementation.
