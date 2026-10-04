import { describe, expect, it } from "vitest";
import { attentionOrder } from "./attention.js";

const e = (name: string, state: Parameters<typeof attentionOrder>[0][number]["state"], lockTime: string | null = null) => ({
  name,
  state,
  lockTime,
});

describe("attentionOrder", () => {
  it("puts picks to make first, then picked, locked, out, season over", () => {
    const sorted = attentionOrder([
      e("over", "season_over"),
      e("out", "eliminated"),
      e("locked", "locked", "2026-09-17T17:00:00Z"),
      e("picked", "picked", "2026-09-17T17:00:00Z"),
      e("needs", "needs_picks", "2026-09-17T17:00:00Z"),
    ]);
    expect(sorted.map((x) => x.name)).toEqual(["needs", "picked", "locked", "out", "over"]);
  });

  it("orders entries that both need picks by the soonest lock", () => {
    const sorted = attentionOrder([
      e("later", "needs_picks", "2026-09-20T17:00:00Z"),
      e("sooner", "needs_picks", "2026-09-17T17:00:00Z"),
    ]);
    expect(sorted.map((x) => x.name)).toEqual(["sooner", "later"]);
  });

  it("keeps the joined order for equals and does not change the input", () => {
    const input = [e("a", "picked"), e("b", "picked")];
    expect(attentionOrder(input).map((x) => x.name)).toEqual(["a", "b"]);
    expect(input.map((x) => x.name)).toEqual(["a", "b"]);
  });
});
