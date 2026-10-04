import { describe, expect, it } from "vitest";
import { needsDisplayName, publicName } from "./display-name.js";

describe("publicName", () => {
  it("keeps a normal name, trimmed", () => {
    expect(publicName("Robin S.")).toBe("Robin S.");
    expect(publicName("  Big Mike ")).toBe("Big Mike");
  });
  it("shows only the part before the @ when the name is an email", () => {
    expect(publicName("larkpopowicz@gmail.com")).toBe("larkpopowicz");
    expect(publicName("a.b@c.d")).toBe("a.b");
  });
  it("falls back to the invited name, then to A player", () => {
    expect(publicName(null, "Big Mike")).toBe("Big Mike");
    expect(publicName("", "x@y.z")).toBe("x");
    expect(publicName(null, null)).toBe("A player");
    expect(publicName("   ")).toBe("A player");
    expect(publicName("@gmail.com")).toBe("A player");
  });
});

describe("needsDisplayName", () => {
  it("is true for empty names and email addresses only", () => {
    expect(needsDisplayName("")).toBe(true);
    expect(needsDisplayName(null)).toBe(true);
    expect(needsDisplayName("lark@example.com")).toBe(true);
    expect(needsDisplayName("Lark P.")).toBe(false);
  });
});
