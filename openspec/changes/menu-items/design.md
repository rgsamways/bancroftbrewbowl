## Context

Mockups: `menu-public`, `menu-drinks`, `menu-kitchen`, `admin-menu`, `admin-menu-kitchen`, `admin-menu-item`, `admin-step-item-1..4/done`. The app currently renders only `<Login />` for anyone without a session (`App.tsx`). Admin writes follow the existing pattern: `requireAdmin`, Zod body, `recordActivity` in the same transaction (`routes/promotions.ts`, `routes/admin-requests.ts`).

## Decisions

- **One table, `menu_items`.** Drinks and dishes share fields and screens. Columns: `id`, `kind` (`beer|wine|drink|dish`, text checked in `@bbb/shared`), `section` (text: fixed names "On tap", "Wine", "Other drinks" for drinks; free text for kitchen such as "Smokehouse plates"), `name`, `style`, `abv` (text as typed, e.g. "6.2%"), `description`, `price_cents` (nullable int), `options` (jsonb `[{name, priceCents|null}]`, default `[]`, for add-ons like "Add brisket +$9" and side choices), `labels` (text[] from `new|seasonal`), `available` (boolean, default true), `sort_order` (int), `created_at`, `updated_at`. Options are jsonb because they are only read and written with their item.
- **Order.** `sort_order` = highest in the section + 1 at creation; the list is shown by section then `sort_order`. No reorder screen now.
- **Availability.** A switched-off item stays on the public menu marked "Out" (the mockup: "players see it as gone straight away"); it does not disappear. Remove is permanent.
- **Public read.** `GET /public/menu` needs no session and returns only public fields (no ids of users, no timestamps beyond what is needed). Short cache-control (`public, max-age=30`) so QR traffic is cheap but a sold-out switch shows within seconds.
- **Admin routes.** `POST /menu/items`, `PATCH /menu/items/:id`, `PATCH /menu/items/:id/availability`, `DELETE /menu/items/:id`, plus `GET /menu/items` for the admin list (same data as public, plus ids). All `requireAdmin` and `recordActivity` (kinds `menu_item_added|menu_item_changed|menu_item_removed|menu_item_availability_changed`, category `menu`, which the Activity "Menu" filter already uses). They never need a second admin's confirmation.
- **Validation.** Name 1 to 80 characters; style up to 40; abv up to 10; description up to 300; price 0 to 100000 cents, or null; labels from the allowed list, no duplicates; options at most 12, each name 1 to 60; kind/section consistent (beer, wine and drink use the fixed sections; a dish needs a non-empty section up to 60).
- **Signed-out access.** In `App.tsx`, routes `/menu`, `/menu/kitchen` are matched before the `!session` gate and rendered in a public frame (`PublicPage` style plus the sign-in banner). Signed in, the same page content renders in the Shell with the Menu tab highlighted. The menu page component takes a `public` flag only for the frame; the content and data are the same.
- **Tabs.** `tabsFor` returns Home, Pick, Standings, Menu, then Admin for admins. `activeTab` maps `/menu` and `/menu/*` to menu. The admin bar becomes Next step, Results, Menu, Pools, More with Menu at `/admin/menu`.
- **Admin Menu screens.** List (Drinks and Kitchen sub-tabs, "Add a drink / Add a dish", per-row switch with an accessible label, row opens edit); four-step add wizard in `FocusLayout` (what, name and style, extras, review) then a done screen with "Back to the menu / Add another"; edit page with Save and Remove (confirm first).
- **No seed data, no test data in production.** Real items are typed by the brewery. Tests clean up their own rows.

## Risks

- Public route abuse: read-only and cached; no user data. Rate limiting is not added now.
- A bad migration blocks the deploy: run it on staging's own database first.
- Tab count changes (4 for players, 5 for admins) need to fit 390 px with 44 px targets; the e2e spec checks it.
- The legal wording of the menu is unchecked with the owner and AGCO; this change adds only the "Please drink responsibly." line and states no health or strength claims beyond what is typed.
