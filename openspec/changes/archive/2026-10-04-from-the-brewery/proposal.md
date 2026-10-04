## Why

Slice 12 of the v2 build. Players should see what is happening at the brewery right on Home: a featured drink or dish, a special on the days it runs, and a weekly announcement. Today Home shows nothing of the kind, and the only way to post anything is the interim Promotions page (weekly free text plus four automatic offers whose wording clashes with the no-rewards rule). This also takes the announcement wizard moved out of slice 9.

## What Changes

- The existing `promotions` table is extended (migration 0010, no new table) so one table holds three kinds: announcement (what it is today), feature (a menu item) and special (days and times, or one date). New columns are nullable except `kind`, which defaults to announcement so every existing row stays valid. The week columns become nullable.
- Home gets an "At the brewery" section: the featured item, specials on today, then the announcement (or a standard "Watch with us" message). Parts that don't apply are left out. The data arrives in the existing `GET /me/summary` request.
- Admins get a "From the brewery" screen under More with a "Showing now" list, and short wizards to feature a menu item (2 steps), add a special (3 steps) and write an announcement (3 steps). Remove asks first. "Add live music" leads to the existing music wizard.
- New admin-only routes under `/brewery`; every change is recorded in Activity.
- The interim Promotions page and its `/promotions` routes are removed. The four automatic offers disappear from every screen; their table and routes stay dormant (not deleted here).
- **Not in this change:** the "Live this weekend" Home card (slice 13), editing a posted item (remove and post again), the past-announcements list, and any offer linked to standings or winning (waiting on the owner and AGCO).

## Capabilities

### New Capabilities
- `from-the-brewery`: featured items, specials and announcements, how admins post them, and how they appear on Home.

### Modified Capabilities
- `admin-steps`: More leads to From the brewery instead of the interim Promotions page.

## Impact

- Schema: columns added to `promotions` (migration 0010); `season_year` and `week_number` loosened to nullable.
- API: new `routes/brewery.ts`; `routes/promotions.ts` removed; `routes/home.ts` and the summary type gain `brewery`; new activity kinds.
- Shared: new `brewery.ts` (schemas, schedule text, day matching) with unit tests.
- Dashboard: `Home.tsx`, `AdminMore.tsx`, `App.tsx`, `lib/nav.ts`, `AdminLayout.tsx`, new `pages/admin-brewery/*`; `PromotionsPage.tsx` removed.
- Tests: API tests (real Postgres), unit tests, new `e2e/admin-brewery.spec.ts` and `e2e/brewery-home.spec.ts`, and an update to `e2e/frame.spec.ts`.
