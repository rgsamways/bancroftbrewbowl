## 1. Schema and shared

- [x] 1.1 Add `admin_requests` table and migration 0007 (additive); verify on a local database
- [x] 1.2 Shared types, request kinds and statuses, and the three new activity kinds

## 2. API (tests first, real Postgres)

- [x] 2.1 Extract the wipeout-resolve and status-edit changes into functions both the routes and confirm can call
- [x] 2.2 Wipeout resolve and status edit create a request when the rule triggers; apply at once for a sole admin
- [x] 2.3 Confirm, decline, seen and detail routes; refuse requester and non-admins; handle stale requests
- [x] 2.4 `GET /admin/summary` returns pending and declined requests; next step order updated
- [x] 2.5 Activity records for ask, confirm, decline; coverage test passes

## 3. Screens

- [x] 3.1 Wipeout and status screens: notice and "Ask another admin to confirm"; sent screen
- [x] 3.2 Confirm screen, decline screen, confirmed and declined end screens
- [x] 3.3 Next step cards: confirm, needs another look, waiting
- [x] 3.4 `e2e/` spec for the flow at 390 wide

## 4. Verify and ship

- [x] 4.1 `pnpm lint`, `typecheck`, `typecheck:e2e`, `test`, `test:e2e` pass
- [x] 4.2 Call out the schema change; push to `staging`, confirm migration ran on staging's own database and its API works
- [x] 4.3 Promote to `main`, confirm production deploy and migration
- [x] 4.4 Sync specs, archive, update ROADMAP and HANDOFF
