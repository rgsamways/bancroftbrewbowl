## Why

Slices 1 to 13b are live. This is the last required v2 slice: remove what the redesign left behind, make the docs tell the truth about the app as it is now, and mark the release as v2.0.0. Nothing a player or admin sees changes.

## What Changes

- Remove the dead "canned promotions" code (four automatic offers). Nothing in the app calls it since slice 12: the API routes and their registration, the shared schema, labels and defaults, the update schema, and the one test that used it.
- **Keep** the `canned_promotions` table and every migration. No schema change; dropping the table is destructive and not needed. Keep the `canned_promotion_changed` activity kind so old activity records still show a title.
- Fix the two buttons on the Account page that still have white text on copper (poor contrast); use the dark ink the other buttons use.
- Refresh the docs that describe the old app: `docs/BUILD_PLAN.md` (shell, Home, admin, promotions), `docs/HANDOFF.md` (start-here block), `docs/NEW_CLIENT_SETUP.md` (v2 steps), and a short `README.md`.
- Mark slice 15 in `openspec/ROADMAP.md`.
- Tag `v2.0.0` on `main` (git tag only; package versions stay 0.0.0). **The tag is the last step and waits for Robin's go**, because he wants a plan for the late start and the results cleanup settled first.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None. No behaviour a player or admin can see changes, so there is no spec delta (`skip_specs: true`).

## Impact

- API: `routes/canned-promotions.ts` deleted; `index.ts`, `test/route-harness.ts`, `db/schema.ts` (the unused config type import only; the table stays), `lib/pick-lock.ts` comment; `activity.test.ts` rewritten to use another admin write route.
- Shared: `canned-promotions.ts`, its export, `updateCannedPromotionSchema` in `api-schemas.ts`; the activity kind stays.
- Dashboard: `pages/Account.tsx` button text colour.
- Docs and roadmap as above. No new dependencies, no migration.
