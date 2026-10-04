## 1. Remove the retired offers

- [x] 1.1 Delete `apps/api/src/routes/canned-promotions.ts` and its registration in `index.ts` and `test/route-harness.ts`; remove the shared `canned-promotions.ts`, its export and `updateCannedPromotionSchema`; drop the unused config import from `db/schema.ts` but leave the `canned_promotions` table; fix the comment in `lib/pick-lock.ts`
- [x] 1.2 Keep the `canned_promotion_changed` activity kind; rewrite the `activity.test.ts` case to use a brewery write route
- [x] 1.3 `pnpm lint`, `typecheck`, `typecheck:e2e`, `test` pass; confirm `pnpm db:generate` finds no schema change

## 2. Contrast

- [x] 2.1 Account page: the two copper buttons use dark ink instead of white; look at them in Chrome at 390 wide; `e2e` account/frame specs still pass

## 3. Docs

- [x] 3.1 `docs/BUILD_PLAN.md`: header date and commit, promotions and brewery, shell (`Shell`, `BottomTabs`, `AppHeader`, `AdminLayout`, `FocusLayout`), Home, the v2 admin, remove the canned promotions and old admin description
- [x] 3.2 `docs/HANDOFF.md`: rewrite the start-here block and "temporary pieces" to match reality
- [x] 3.3 `docs/NEW_CLIENT_SETUP.md`: password sign-in, `make-admin` and `reset-password`, pool total, menu and brewery content
- [x] 3.4 `README.md`: a short description, how to run, where the docs are
- [x] 3.5 `openspec/ROADMAP.md`: slice 15 status

## 4. Verify and ship

- [x] 4.1 `pnpm test:e2e` passes
- [ ] 4.2 Push to `staging`, check it, promote to `main`, confirm the deploy (no schema change, no test data on production)
- [ ] 4.3 Archive the change
- [ ] 4.4 **Wait for Robin's go**, then tag `v2.0.0` on `main` and push the tag
