## Context

See proposal.md for why. What exists today in `apps/dashboard`:

- `Shell.tsx` wraps all signed-in routes: a sticky left `Sidebar` (a slide-out drawer below the `lg` breakpoint), a mobile top bar with a hamburger and a help button, a resizable right-hand `RightPanel` help drawer, and a `PageHeader` that shows a title for the routes `matchNav` knows (Home, Schedule, Pools, Promotions, Account).
- Three small contexts drive that chrome: `MobileNavContext`, `RightPanelContext`, and `AdminPanelContext`. The last one is different: `AdminDashboard` uses it to tell `PageHeader` which pool is selected, so it must stay.
- `Sidebar` also holds the "Your pools" shortcuts, the three admin links (Pools, Schedule, Promotions, shown when `isAdmin`), and the **Sign out** button. None of those have another home yet.
- Colours and fonts live in the Tailwind `@theme` block in `src/index.css` (Oswald and Poppins, loaded from `index.html`). Pages use the `brand-*` colour classes and `font-display`.
- Routes (`App.tsx`): `/`, `/account`, `/pool/:poolId`, `/pool/:poolId/entry/:entryId/pick`, `/admin`, `/admin/:poolId`, `/admin/schedule`, `/admin/promotions`. There is no `/pick` or `/standings`.
- The dashboard has no component tests; the root vitest run covers `apps/*/src/**/*.test.ts`, so a pure `.ts` module can be unit tested there.

The target look is `docs/v2/mockups` (for example `home.html`, `account.html`): a header with the logo tile, name and avatar, and a bottom bar of icon-over-label tabs.

## Goals / Non-Goals

**Goals:**
- A frame that works one-handed on a phone and leaves every current page working inside it.
- All new frame behaviour (which tabs, which is active, where Pick and Standings go) expressed as small pure functions with tests.
- The new colours and font applied app-wide by changing the tokens, not by editing every page.

**Non-Goals:**
- Redesigning any page's content. Home, Pick, Standings, Account and the admin pages keep their current layouts and are restyled in their own slices.
- A Menu tab, a Me tab, a desktop-specific layout, or any API or database change.
- Fixing the staging preview's connection to the staging API.

## Decisions

### 1. Tab logic is two pure functions, tested
`tabsFor({ isAdmin })` returns the ordered tab list (Home, Pick, Standings, and Admin for admins). `activeTab(pathname)` returns which tab, if any, the path belongs to (`/` is Home; `/pick` and `/pool/:id/entry/:id/pick` are Pick; `/standings` and `/pool/:id` are Standings; anything under `/admin` is Admin; `/account` is none). Both live in `src/lib/tabs.ts` with unit tests, so the component is just rendering.
*Alternative:* reuse `matchNav` (rejected: it describes the old sidebar and page titles, and its keys don't match the tabs).

### 2. The frame is three small components
`AppHeader` (logo tile, name, avatar), `BottomTabs` (renders `tabsFor` with `activeTab`, Lucide icons, 44 pixel targets, `env(safe-area-inset-bottom)` padding for phones with a home bar), and the rebuilt `Shell`, which lays them out with a `pb-24` main so nothing hides behind the bar. The bar is full width with its tabs centred in a `max-w-lg` row, so on a desktop browser it still looks intentional.
*Alternative:* a centred phone-width column on desktop (rejected: several old admin pages, such as the picks table, need the room).

### 3. `PageHeader` and `AdminPanelContext` stay
Old pages still rely on the shared page title (and the selected pool's name on the admin page). `PageHeader` stays, restyled by the tokens, and `AdminPanelProvider` stays. Only the sidebar, top bar, help drawer and their two contexts go.

### 4. The interim admin sub-navigation lives in the Shell
On any `/admin` route the Shell shows a three-way sub-navigation (Pools, Schedule, Promotions) under the header, reusing `matchNav` for which one is current. It is a stopgap that disappears in the step-by-step admin slice, so it is kept tiny and does not get its own abstraction.

### 5. `/pick` and `/standings` are small resolver pages
Each loads `/me/entries` once and applies the rules in the spec: one alive entry for Pick, or one pool for Standings, redirects (`replace`, so Back doesn't bounce); several show a list; none shows "join a pool first" with a link home. The rule is a pure function (`pickDestination(entries)`, `standingsDestination(entries)`) with tests; the pages just act on its result. Slice 6 and 7 replace these with the real designed screens.

### 6. Sign out moves to the Account page
A plain button calling the existing `authClient.signOut()`, then showing the sign-in page (the app already renders sign-in when there is no session). Placed at the bottom of the page where the mockup puts it.

### 7. Tokens are changed in one place
`index.css` gets the v2 values for the existing `brand-*` names (so old pages restyle with no edits) plus a few new ones the new frame needs (`brand-accent-ink`, `brand-faint`, success and danger). Both font variables become Inter, and `index.html` loads Inter instead of Oswald and Poppins. Old pages' `font-display` uppercase headings stay uppercase but now in Inter.
*Alternative:* edit every page to the new classes (rejected: that is exactly what the later slices are for, and it would make this change enormous).

### 8. Removing help is deliberate
The right-hand drawer and the per-page help text in `nav.ts` go with it. v2's plan replaces them with inline hints and a How to play page (slice 13). Until then, a page simply has no help button.

## Risks / Trade-offs

- **Old pages use white text on copper buttons, which is only 3.4 to 1 contrast** (the new frame itself meets 5.6 to 1) → known and accepted for this slice; each page is fixed as it is redone, with dark ink on copper.
- **The sidebar's "Your pools" shortcuts disappear** → Home already lists pools, and the Pick and Standings tabs reach them.
- **Admins lose the always-visible link list** → the interim sub-navigation covers Pools, Schedule and Promotions.
- **A page looks off under the new tokens** (a colour that read well on the old grey now doesn't) → every route in the walkthrough is screenshotted and looked at, at phone width.
- **Staging can't check the screens** → the real check is local, using the real browser against the local API and database, plus a production build; after release the public sign-in page is checked on the live site.
- **Release is visible to everyone at once** → per Robin's rule slices go live as soon as verified; undoing it is a revert (no data change).

## Migration Plan

1. No API or database change.
2. Verify locally, push to the `staging` branch (which still builds and deploys), then fast-forward `main`. The dashboard (Vercel) deploys from `main` automatically.
3. After release, open the public sign-in page on the live site and confirm the new font and colours loaded.
4. Rollback is a revert of the commit.
