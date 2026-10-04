import { describe, expect, it } from "vitest";
import { updatePoolSchema } from "./api-schemas.js";
import { formatPoolTotal, MAX_POOL_TOTAL_CENTS, parsePoolTotal, poolTotalToInput } from "./pool-total.js";

describe("parsePoolTotal", () => {
  it("reads whole dollars and cents", () => {
    expect(parsePoolTotal("320")).toEqual({ ok: true, cents: 32000 });
    expect(parsePoolTotal("320.50")).toEqual({ ok: true, cents: 32050 });
    expect(parsePoolTotal("320.5")).toEqual({ ok: true, cents: 32050 });
    expect(parsePoolTotal(" $1,250 ")).toEqual({ ok: true, cents: 125000 });
    expect(parsePoolTotal("0")).toEqual({ ok: true, cents: 0 });
  });

  it("treats an empty field as clearing the total", () => {
    expect(parsePoolTotal("")).toEqual({ ok: true, cents: null });
    expect(parsePoolTotal("   ")).toEqual({ ok: true, cents: null });
  });

  it("refuses a negative amount with its own message", () => {
    expect(parsePoolTotal("-5")).toEqual({ ok: false, message: "Enter an amount of $0 or more." });
  });

  it("refuses text and more than two decimal places", () => {
    const message = "Enter the amount as a number, like 320 or 320.50.";
    expect(parsePoolTotal("lots")).toEqual({ ok: false, message });
    expect(parsePoolTotal("3.205")).toEqual({ ok: false, message });
    expect(parsePoolTotal("12abc")).toEqual({ ok: false, message });
  });

  it("accepts exactly $1,000,000 and refuses more", () => {
    expect(parsePoolTotal("1000000")).toEqual({ ok: true, cents: MAX_POOL_TOTAL_CENTS });
    expect(parsePoolTotal("1000000.01")).toEqual({ ok: false, message: "That amount is too large." });
    expect(parsePoolTotal("99999999999999999999")).toEqual({ ok: false, message: "That amount is too large." });
  });
});

describe("formatPoolTotal and poolTotalToInput", () => {
  it("shows whole dollars without cents and others with two decimals", () => {
    expect(formatPoolTotal(32000)).toBe("$320");
    expect(formatPoolTotal(32050)).toBe("$320.50");
    expect(formatPoolTotal(5)).toBe("$0.05");
    expect(formatPoolTotal(0)).toBe("$0");
    expect(formatPoolTotal(125000)).toBe("$1,250");
  });

  it("gives back what to show in the field", () => {
    expect(poolTotalToInput(32000)).toBe("320");
    expect(poolTotalToInput(32050)).toBe("320.50");
    expect(poolTotalToInput(null)).toBe("");
    expect(poolTotalToInput(undefined)).toBe("");
  });
});

describe("updatePoolSchema pool_total_cents", () => {
  it("accepts null, 0 and the maximum", () => {
    expect(updatePoolSchema.safeParse({ pool_total_cents: null }).success).toBe(true);
    expect(updatePoolSchema.safeParse({ pool_total_cents: 0 }).success).toBe(true);
    expect(updatePoolSchema.safeParse({ pool_total_cents: MAX_POOL_TOTAL_CENTS }).success).toBe(true);
  });

  it("refuses negatives, decimals, larger values and text", () => {
    for (const bad of [-1, 1.5, MAX_POOL_TOTAL_CENTS + 1, "320"]) {
      expect(updatePoolSchema.safeParse({ pool_total_cents: bad }).success).toBe(false);
    }
  });
});
