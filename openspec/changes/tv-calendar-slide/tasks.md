## 1. The data and the repeat rules

- [ ] 1.1 Schema: `calendar_entries` and `calendar_exceptions` (unique entry and date, cascade); `pnpm db:generate`, review the SQL is additive only, migrate locally and verify the tables exist
- [ ] 1.2 `packages/shared`: types, Zod schemas (title, times, type, note, link rules, repeat choices), the link-to-path helper, new Activity kinds, and `occurrencesForMonth`; unit tests for weekly, every 2 weeks, 2nd and 5th weekday, end date, month and leap-day edges, daylight saving weekends, exceptions (cancel, override, ignored on a non-occurrence), music merge, ordering with all-day first, and unsafe links refused

## 2. The API

- [ ] 2.1 `GET /public/calendar?month=`: no sign-in, `no-store`, month range limit, music merged, deleted-pool links dropped; tests: no private fields in the body, a cancelled day, a series across a month boundary
- [ ] 2.2 Admin routes (list by month, create, edit all, delete all, change one day, cancel one day) behind `requireAdmin`; tests: player refused, end before start, `javascript:` and `http:` links refused, deleting a series removes its exceptions
- [ ] 2.3 Each write records Activity (no exceptions to the coverage test) and the sentence names the entry and date; verify in the Activity tests

## 3. The phone calendar

- [ ] 3.1 Calendar tab in `PublicMenuPage` and `MenuPage` with `/menu/calendar?month=`; month grid with today and type marks, previous and next, "This month", tappable days, the day panel with link buttons (in-app navigates, `https` opens in a new tab with `noopener noreferrer`); no sideways scroll at 390 wide
- [ ] 3.2 Component tests or a browser check for empty months, a six-entry day, and keyboard and screen-reader labels on the days

## 4. The TV slide (after `tv-screens-and-playlists`)

- [ ] 4.1 Add `calendar` to the slide kinds, the playlist editor's "add a slide" list and the public TV feed (current month, brewery time)
- [ ] 4.2 The slide: full-screen month grid on the 1280 by 664 area, type tags with text, "+N more", no links, empty month still shows the grid; unit test for the line limit and week count (4, 5 and 6 week months)

## 5. The admin screens

- [ ] 5.1 More > Calendar: month list with previous and next, music rows marked "from Music" and read-only, add and edit form with the four repeat choices and an end date
- [ ] 5.2 Editing or removing a repeating entry asks "Just this day" or "All in the series"; cancelling one day; plain wording at 390 wide

## 6. Tests in a real browser

- [ ] 6.1 `e2e/calendar.spec.ts`: add a one-off and a weekly entry as an admin, see them on the public page signed out, tap a day, follow a link, cancel one day and see only that day gone, music shows without a second entry, a player cannot reach the admin screens; update `e2e/alignment.spec.ts` for the new pages; TV slide covered in the TV spec once it exists

## 7. Verify and ship

- [ ] 7.1 `pnpm lint`, `typecheck`, `typecheck:e2e`, `test`, `test:e2e` pass
- [ ] 7.2 Call out the schema change, migrate staging first, check the public calendar on the staging API, then push (batch pushes; mind the Vercel build limit); Robin looks at it on a phone and a TV
- [ ] 7.3 Sync specs (check the merged admin-activity text includes both changes), archive, update ROADMAP and HANDOFF
