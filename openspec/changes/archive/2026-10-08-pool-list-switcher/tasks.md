## 1. Shared logic

- [x] 1.1 Add `entryNeed(entry)` (the short "what needs doing" line) in `lib/`, using the Eastern-time helper. Verify with unit tests for every entry state, a lock time today and on another day, and a per-game pool.
- [x] 1.2 Generalise `lastPoolPath` to open a given pool on the remembered screen (default Pick), keeping the one-pool landing behaviour. Verify with unit tests: remembered screen, no memory, pool not in the list.

## 2. Screens

- [x] 2.1 Build the pool list as `/play` for two or more pools (cards: name, type, standing, `entryNeed`; ordered with `attentionOrder`; one pool still redirects; no pool keeps the message). Verify in the browser at 390 px with four long-named pools: no sideways scroll, cards in order, tapping a card opens that pool on the remembered screen.
- [x] 2.2 Add the pool-name header to `PoolScreenTabs` (link to `/play` with two or more pools, plain text with one) and remove `PoolTabs` from Standings. Verify in the browser: switch pools from the Pick screen and from Standings; no chips remain; the bottom bar still clears the content.
- [x] 2.3 Replace Home's `PoolChips` with the compact switcher (name and chevron, inline list, marked current, closes on choice) and delete `PoolChips`. Verify in the browser: switching changes the hero without a reload, one pool shows nothing, long names fit.

## 3. Tests and specs

- [x] 3.1 Update the browser specs that used chips (`frame`, `home-states`, others found by searching for `Your pools` and `aria-pressed`) and add cases for the list, the header and Home's switcher. Verify with `pnpm test:e2e` passing.
- [x] 3.2 Run `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:e2e` and `pnpm test`; all clean.

## 4. Finish

- [x] 4.1 Update `openspec/ROADMAP.md` and `docs/HANDOFF.md`; look at it in a phone-size window with two and four pools, then sync specs and archive. No schema change, so a normal push to `main`.
