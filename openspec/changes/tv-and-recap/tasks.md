## 1. Shared types

- [x] 1.1 `tv.ts` and `recap.ts` types and `formatShare` in `packages/shared`, exported from `index.ts`; unit test for `formatShare`

## 2. API

- [x] 2.1 `lib/pick-counts.ts`: per-team counts for a pool and week, empty before the lock; test for before and after the lock, shares, top 3
- [x] 2.2 `GET /pools/:poolId/tv` (`routes/tv.ts`) for survivor and pick 'em; tests incl. status values, 401, 404, no emails or individual picks
- [x] 2.3 `lib/recap.ts` and `GET /pools/:poolId/recap?week=N`: default week, 404 for undecided, players out, upset rule (ties, no picks), viewer's own result, pick 'em variant; tests
- [x] 2.4 `recapWeek` on each entry in `GET /me/summary`; test

## 3. Dashboard

- [x] 3.1 `TvLayout` and TV page at `/pool/:poolId/tv` (outside `Shell`), 30 s refresh, QR, survivor and pick 'em variants
- [x] 3.2 Recap page at `/pool/:poolId/recap` with Share (share sheet or copy) and Back to Home
- [x] 3.3 "Week N recap" card on Home; "Show on TV" link at the end of Standings

## 4. Tests in a real browser

- [x] 4.1 `e2e/tv.spec.ts` (1280 by 720): before and after the lock, pick 'em variant, QR present
- [x] 4.2 `e2e/recap.spec.ts` (390 by 844): card on Home, recap content, Share fallback, no sideways scroll
- [x] 4.3 Update `home-states` and `standings` specs for the new card and link

## 5. Verify and ship

- [x] 5.1 `pnpm lint`, `typecheck`, `typecheck:e2e`, `test`, `test:e2e` pass
- [x] 5.2 Walk both pages in real Chrome against the mockups
- [ ] 5.3 Push to `staging`, check its API, promote to `main`, confirm the production deploy (read-only, no test data)
- [ ] 5.4 Sync specs, archive, update `openspec/ROADMAP.md` and `docs/HANDOFF.md`
