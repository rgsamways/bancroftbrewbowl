## 1. Tab and destination logic (pure, tested)

- [x] 1.1 Add `apps/dashboard/src/lib/tabs.ts` with `tabsFor`, `activeTab`, `pickDestination` and `standingsDestination`, and unit tests covering every scenario in the spec (player tabs, admin tabs, each active-tab path including `/account` and unknown paths, one/several/none/eliminated entries for both destinations); verify `pnpm test` passes

## 2. Look and feel

- [x] 2.1 Change the `@theme` tokens in `src/index.css` to the v2 values (adding the new names the frame needs) and switch the fonts to Inter in `index.css` and `index.html`; verify `pnpm --filter @bbb/dashboard build` succeeds and a screenshot of an old page (Home) shows the new colours and font

## 3. The frame

- [x] 3.1 Add `AppHeader` and `BottomTabs` (Lucide icons, 44 pixel targets, safe-area padding, highlighted tab in copper) and rebuild `Shell.tsx` around them, keeping `PageHeader` and `AdminPanelProvider`; verify `pnpm typecheck` passes
- [x] 3.2 Add the interim admin sub-navigation (Pools, Schedule, Promotions) to the Shell for `/admin` routes; verify it renders and each link reaches its page in the walkthrough (task 6.1)
- [x] 3.3 Delete `Sidebar.tsx`, `RightPanel.tsx`, `MobileNavContext.tsx`, `RightPanelContext.tsx` and the help text in `lib/nav.ts`; verify nothing still imports them (`pnpm typecheck` and `pnpm lint` pass)

## 4. Where the tabs lead

- [x] 4.1 Add the `/pick` and `/standings` pages and routes using the pure destination functions from 1.1; verify against the local database with zero, one, and several entries (done in the walkthrough, task 6.1)
- [x] 4.2 Add a Sign out button to `Account.tsx`; verify it signs out and shows the sign-in page (walkthrough, task 6.1)

## 5. Checks

- [x] 5.1 Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm --filter @bbb/dashboard build` from the repo root and verify all pass

## 6. Verify and ship

- [x] 6.1 Walk through the local app in real Chrome at 390 by 844 as a player with no pools, one pool, and several pools, and as an admin: tabs shown, active tab marked, header avatar and logo, Pick and Standings destinations, Me and Sign out, every admin page via the sub-navigation, Home, standings and the pick screen still working; check no sideways scroll, 44 pixel tap targets, content clear of the bar, and look at a screenshot of every route; fix anything that looks wrong
- [ ] 6.2 Push to the `staging` branch and confirm it builds and the staging API still answers; push `main` and confirm the production deploys succeed
- [ ] 6.3 On the live site, open the public sign-in page and verify the new font and colours loaded; update `openspec/ROADMAP.md`, sync specs, archive the change
