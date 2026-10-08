## 1. Scoreboard

- [ ] 1.1 In `components/Scoreboard.tsx`, replace the pool-name badge with a tinted row and a short "Your pick" / "Your pick ×N" chip beside the name; remove the extra line. Verify in the browser at 390 px with a team picked in one pool and in two pools: one-line rows, full team name visible, no sideways scroll.
- [ ] 1.2 Update `e2e/scoreboard.spec.ts` for the new marker and add a team picked in two pools ("Your pick ×2", no pool names). Verify `pnpm test:e2e` passes for the scoreboard and alignment specs.
- [ ] 1.3 Run `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:e2e` and `pnpm test`; all clean.

## 2. Finish

- [ ] 2.1 Update `openspec/ROADMAP.md` and `docs/HANDOFF.md`; Robin looks at it on his phone, then sync specs and archive. Normal push to `main`, no schema change.
