import { describe, expect, it } from "vitest";
import { initials } from "./standings.js";

describe("initials", () => {
  it("uses the first letters of the first two words", () => {
    expect(initials("Robin Samways")).toBe("RS");
    expect(initials("  big   mike jones ")).toBe("BM");
  });
  it("uses two letters of a single word", () => {
    expect(initials("Dave")).toBe("DA");
  });
  it("falls back to the email's first letter, then a question mark", () => {
    expect(initials("", "robin@example.com")).toBe("R");
    expect(initials(null, null)).toBe("?");
  });
});
