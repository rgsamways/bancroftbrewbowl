## Why

Slice 11a of the v2 build. The brewery needs a menu players (and anyone with a table QR code) can read without signing in, and a simple way for the owner's wife to keep it current: add a beer or dish, switch it off when it runs out. Today there is no menu at all, and every signed-out visitor is sent to the sign-in page. This is the first half of slice 11; live music follows as `music-events`.

## What Changes

- A new table `menu_items` (additive, migration 0008) holds beers, wines, other drinks and dishes, with optional style, strength, description, price, add-ons, labels (New, Seasonal), an available switch, and the order they were added.
- Public read-only `GET /public/menu` (no sign-in) returns the menu, grouped, with no admin fields.
- A Menu tab for signed-in players (Home, Pick, Standings, Menu, then Admin) and a public menu page at `/menu` for signed-out visitors, with Drinks and Kitchen sections, a "Play Brew Bowl, Sign in" banner and "Please drink responsibly."
- The admin tab bar becomes Next step, Results, Menu, Pools, More. Admin Menu screens: list with an on-tap/out switch, a four-step add wizard, edit and remove. Admin writes require an admin and are recorded in Activity.
- No seed data and no ordering or payment. Prices are optional and shown only if typed.
- **Not in this change:** live music (next change `music-events`), the "Live this weekend" Home card, reordering items, the "From the brewery" features that point at menu items (slice 12).

## Capabilities

### New Capabilities
- `menu-items`: the menu data, the public menu, the player Menu tab content, and the admin screens to keep it current.

### Modified Capabilities
- `app-shell`: the tab bar for signed-in people now includes Menu.
- `admin-steps`: the admin tab bar now includes Menu.

## Impact

- Schema: one new table `menu_items` (migration 0008).
- API: new `routes/menu.ts` (public read, admin writes); new activity kinds in `packages/shared/src/admin-activity.ts`; schemas in `packages/shared/src/api-schemas.ts`.
- Dashboard: `App.tsx` (public routes ahead of the sign-in gate), `lib/tabs.ts`, `BottomTabs.tsx`, `AdminLayout.tsx`, new menu pages.
- Tests: API tests (real Postgres), tab unit tests, new `e2e/menu.spec.ts` and `e2e/admin-menu.spec.ts`, updates to specs that list tabs.
