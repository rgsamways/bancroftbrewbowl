import { describe, expect, it } from "vitest";
import { shouldShowInstallCard } from "./install.js";

describe("shouldShowInstallCard", () => {
  it("shows in a browser tab until dismissed", () => {
    expect(shouldShowInstallCard({ standalone: false, dismissed: false })).toBe(true);
    expect(shouldShowInstallCard({ standalone: false, dismissed: true })).toBe(false);
  });
  it("never shows once the app is installed", () => {
    expect(shouldShowInstallCard({ standalone: true, dismissed: false })).toBe(false);
    expect(shouldShowInstallCard({ standalone: true, dismissed: true })).toBe(false);
  });
});
