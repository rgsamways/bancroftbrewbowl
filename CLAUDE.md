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

## Deploy pipeline

There is no staging environment for this project — it's local → production
directly. The dashboard (Vercel) auto-deploys on push to `main`; the API
(Railway) does **not** auto-deploy — `railway up --service api` is a
required manual step after pushing. State plainly whether a change is only
"done locally," "pushed," or "deployed" — don't let "done" be ambiguous
between those.

## Pace

Don't start any of the deferred/open-thread items in `docs/HANDOFF.md`
unprompted — every feature in this project so far went through an explicit
ask, often with a plan-mode design pass for schema-touching work, before
implementation.
