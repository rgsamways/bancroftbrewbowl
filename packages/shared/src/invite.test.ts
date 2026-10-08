import { describe, expect, it } from "vitest";
import { inviteMessage, joinPathFor, safeDestination } from "./invite.js";

describe("safeDestination", () => {
  it("keeps a plain page inside the app, with its query", () => {
    for (const ok of ["/", "/join/abc", "/join/abc?x=1", "/pool/11111111-1111-4111-8111-111111111111/entry/2/pick", "/menu/calendar?from=2026-10-14", "/pool/1?view=weeks#top", "/%2F%2Fevil.com"])
      expect(safeDestination(ok), ok).toBe(ok);
  });

  it("sends anything that could leave the app to Home", () => {
    const bad = [
      "//evil.com",
      "///evil.com",
      "https://evil.com",
      "http://evil.com/join/x",
      "javascript:alert(1)",
      "data:text/html,hi",
      "/\\evil.com",
      "\\\\evil.com",
      "/join/a\\b",
      "/join/a b",
      "/join/a\tb",
      "/join/a\nb",
      "/join/a\u0000b",
      "join/abc",
      "evil.com",
      "",
      "/a//b",
      "/" + "a".repeat(600),
    ];
    for (const b of bad) expect(safeDestination(b), JSON.stringify(b)).toBe("/");
    expect(safeDestination(null)).toBe("/");
    expect(safeDestination(undefined)).toBe("/");
  });

  it("still allows a double slash in the query, where it is harmless", () => {
    expect(safeDestination("/menu?next=https://x.com/a")).toBe("/menu?next=https://x.com/a");
  });
});

describe("join paths and messages", () => {
  it("points an open pool at its join page and a finished pool at nothing", () => {
    expect(joinPathFor({ id: "p1", status: "active" })).toBe("/join/p1");
    expect(joinPathFor({ id: "p1", status: "draft" })).toBe("/join/p1");
    expect(joinPathFor({ id: "p1", status: "completed" })).toBeNull();
  });

  it("names the pool and nothing personal", () => {
    expect(inviteMessage("Sunday Survivor")).toBe("Join me in Sunday Survivor at Bancroft Brewing's Brew Bowl");
  });
});
