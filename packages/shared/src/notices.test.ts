import { describe, expect, it } from "vitest";
import { closedStillActive, createNoticeSchema, visibleNotices, type Notice } from "./notices.js";

const n = (id: string): Notice => ({ id, title: id, message: "m", showThrough: null });

describe("createNoticeSchema", () => {
  it("accepts a title, a message and an optional date, and refuses the rest", () => {
    expect(createNoticeSchema.safeParse({ title: "Closed Monday", message: "Back Tuesday." }).success).toBe(true);
    expect(createNoticeSchema.parse({ title: "a", message: "b" }).showThrough).toBeNull();
    expect(createNoticeSchema.safeParse({ title: "a", message: "b", showThrough: "2026-10-17" }).success).toBe(true);
    for (const bad of [
      { title: "", message: "b" },
      { title: "a".repeat(61), message: "b" },
      { title: "a", message: "b".repeat(201) },
      { title: "a", message: "b", showThrough: "soon" },
      { title: "a", message: "b", extra: 1 },
    ])
      expect(createNoticeSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
  });
});

describe("closed notices on a device", () => {
  it("hides what was closed, always shows a new notice, and forgets removed ones", () => {
    const active = [n("a"), n("b"), n("new")];
    expect(visibleNotices(active, ["a", "gone"]).map((x) => x.id)).toEqual(["b", "new"]);
    expect(closedStillActive(["a", "gone", "b"], active)).toEqual(["a", "b"]);
    expect(visibleNotices([], ["a"])).toEqual([]);
  });
});
