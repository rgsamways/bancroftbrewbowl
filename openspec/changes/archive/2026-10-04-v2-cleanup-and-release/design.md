## Context

See proposal.md. The old shell (Sidebar, right-hand drawer, mobile nav context, admin panel context) is already gone, and Oswald and Poppins are not referenced anywhere, so the survey found the real leftovers are the canned-promotions backend, a contrast issue on Account, and stale docs.

## Goals / Non-Goals

**Goals:** delete code nothing uses; make docs accurate; tag v2.0.0 safely.

**Non-Goals:** any new behaviour; dropping a database table; bumping package versions; the late-start results cleanup and the location map (separate, Robin's reminders).

## Decisions

- **Leave the `canned_promotions` table and migration history in place.** Dropping it needs a destructive migration that runs automatically on deploy, and the v2 plan says schema changes are additive only. An empty unused table costs nothing. Revisit only if Robin asks.
- **Keep the `canned_promotion_changed` activity kind.** The activity record is append-only; old rows must keep a title. Only the route that wrote them goes.
- **Rewrite, don't delete, the activity test.** The test proves an admin write is recorded with the actor; point it at another admin write route (the brewery routes) so the coverage stays.
- **`PROMOTION_KINDS` stays.** It belongs to the live `promotions` table.
- **Tag, not version bump.** The packages are private workspace packages at 0.0.0; an annotated `v2.0.0` tag on the deployed `main` commit is the release marker.
- **The tag waits for Robin.** It is outward-facing and he asked for the late-start plan first.

## Risks / Trade-offs

- Removing the shared export could break an import elsewhere: typecheck, lint and the full test suites catch it.
- The Account button colour is a visible but tiny change; checked in the browser.
- Docs drift again later; the HANDOFF start-here block is rewritten to be a snapshot with a pointer to live commands.
