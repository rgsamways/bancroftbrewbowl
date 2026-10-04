import { describe, expect, it } from "vitest";
import { draftFromItem, emptyDraft, optionsText, parseOptions, parsePrice, toPayload } from "./draft.js";

describe("parsePrice", () => {
  it("reads dollars into cents, and blank into no price", () => {
    expect(parsePrice("18")).toBe(1800);
    expect(parsePrice("$4.50")).toBe(450);
    expect(parsePrice(" 4.5 ")).toBe(450);
    expect(parsePrice("")).toBeNull();
  });
  it("refuses anything else", () => {
    for (const bad of ["abc", "-3", "4.555", "1,000", "12345"]) expect(parsePrice(bad), bad).toBeUndefined();
  });
});

describe("options", () => {
  it("reads a price after the last comma and leaves the rest as the name", () => {
    expect(parseOptions("Brisket, 9\nColeslaw\n\nSalt, pepper and lime, $2.50")).toEqual([
      { name: "Brisket", priceCents: 900 },
      { name: "Coleslaw", priceCents: null },
      { name: "Salt, pepper and lime", priceCents: 250 },
    ]);
  });
  it("round-trips through text", () => {
    const options = [{ name: "Turkey", priceCents: 700 }, { name: "Plain", priceCents: null }];
    expect(parseOptions(optionsText(options))).toEqual(options);
  });
});

describe("toPayload", () => {
  it("needs a name, and a section for a dish", () => {
    expect(toPayload(emptyDraft("beer")).ok).toBe(false);
    expect(toPayload({ ...emptyDraft("dish"), name: "Nachos" }).ok).toBe(false);
  });
  it("sends only what was filled in", () => {
    const r = toPayload({ ...emptyDraft("beer"), name: " Hawkwatch IPA ", abv: "6.2%", labels: ["new"] });
    expect(r).toMatchObject({ ok: true, body: { kind: "beer", name: "Hawkwatch IPA", style: null, abv: "6.2%", priceCents: null, labels: ["new"], options: [] } });
    expect(r.ok && "section" in r.body).toBe(false);
  });
  it("round-trips an item through the form", () => {
    const item = { id: "1", kind: "dish" as const, section: "Plates", name: "Ribs", style: null, abv: null, description: "With slaw", priceCents: 1800, options: [], labels: [], available: true };
    const r = toPayload(draftFromItem(item));
    expect(r).toMatchObject({ ok: true, body: { section: "Plates", name: "Ribs", description: "With slaw", priceCents: 1800 } });
  });
});
