## 1. Schema and shared

- [x] 1.1 Add `menu_items` table and migration 0008 (additive); run it on the local database
- [x] 1.2 Shared: kinds, sections, labels, validation schemas (create, update, availability), public menu types, and the four menu activity kinds

## 2. API (tests first, real Postgres)

- [x] 2.1 `GET /public/menu` with no session: grouped items, no private fields, revalidate header; test it
- [x] 2.2 Admin `GET /menu/items`, `POST`, `PATCH`, `PATCH .../availability`, `DELETE`; 401 signed out, 403 for players; validation tests
- [x] 2.3 Each admin write records Activity in the same transaction; coverage test passes
- [x] 2.4 Register the routes in `index.ts` and the test harness

## 3. Player and public screens

- [x] 3.1 Menu tab: `tabsFor`, `activeTab`, `BottomTabs`; update the tab unit tests
- [x] 3.2 Menu page (Drinks and Kitchen) with out-of-stock marks, optional prices, add-ons, labels and the drink-responsibly line
- [x] 3.3 Public routes ahead of the sign-in gate in `App.tsx`, with the sign-in banner and no tab bar for signed-out visitors

## 4. Admin screens

- [x] 4.1 Admin bar becomes Next step, Results, Menu, Pools, More; `/admin/menu` list with the available switch
- [x] 4.2 Four-step add wizard and done screen; edit screen with Save and Remove (asks first)

## 5. Tests in a real browser

- [x] 5.1 `e2e/menu.spec.ts`: signed-out visitor, player in the app, out-of-stock showing, no sideways scroll at 390 wide
- [x] 5.2 `e2e/admin-menu.spec.ts`: add, edit, switch off, remove; update specs that list the tabs

## 6. Verify and ship

- [x] 6.1 `pnpm lint`, `typecheck`, `typecheck:e2e`, `test`, `test:e2e` pass
- [x] 6.2 Call out the schema change; push to `staging`; confirm the migration ran on staging's own database and `/public/menu` answers
- [x] 6.3 Promote to `main`; confirm the production deploy and migration; check `/public/menu` on production (read only, no test data)
- [x] 6.4 Archive (syncs specs), update ROADMAP and HANDOFF
