## 1. Shared pieces and the API

- [x] 1.1 `packages/shared`: notice schema (title 1 to 60, message 1 to 200, optional date, strict), Activity kinds `notice_posted` and `notice_removed`, a helper that picks the ids still active to keep in storage; unit tests for the schema and the helper
- [x] 1.2 `lib/brewery.ts` ignores `notice` rows everywhere (Home, admin list, live this weekend); a test posts a notice and an announcement and checks each shows only in its own place
- [x] 1.3 Routes `GET /me/notices`, admin `GET`, `POST`, `DELETE /notices`: active window in Eastern time, three-at-once limit in a transaction, past date refused, delete only removes notices, newest first; tests include player refused, the last day, a fourth notice refused, and a delete of a non-notice id refused
- [x] 1.4 Each write records Activity with the title; the coverage test passes with no exceptions

## 2. The banner

- [x] 2.1 Banner component in `Shell.tsx`: fetches once per page load, renders nothing when empty, plain text, `role` and labels, close button remembered in `localStorage` by id with stale ids dropped; fits 390 wide
- [x] 2.2 Unit test of the closed-ids logic (new id shows, removed ids dropped, storage unavailable)

## 3. The admin screen

- [x] 3.1 More > Notices: form and the active list with Remove and confirm; plain wording at 390 wide; linked only for admins

## 4. Tests in a real browser

- [x] 4.1 `e2e/notices.spec.ts`: admin posts a notice, a player sees it at the top of Home and Standings but an admin page has none, closes it, reload keeps it closed, a new notice shows again, remove makes it vanish, a player cannot reach the admin screen; update `e2e/alignment.spec.ts`

## 5. Verify and ship

- [x] 5.1 `pnpm lint`, `typecheck`, `typecheck:e2e`, `test`, `test:e2e` pass
- [ ] 5.2 Push `main` (no schema change; batch with other work); Robin posts a notice and looks at it on his phone
- [ ] 5.3 Sync specs, archive, update ROADMAP and HANDOFF
