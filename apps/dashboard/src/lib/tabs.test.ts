import { describe, expect, it } from "vitest";
import { activeTab, pickDestination, standingsDestination, tabsFor, type EntryForTabs } from "./tabs.js";

const entry = (id: string, poolId: string, status: "alive" | "eliminated" = "alive", name = `Pool ${poolId}`): EntryForTabs => ({
  id,
  poolId,
  status,
  pool: { name },
});

describe("tabsFor", () => {
  it("gives a player Home, Pick and Standings", () => {
    expect(tabsFor({ isAdmin: false }).map((t) => t.label)).toEqual(["Home", "Pick", "Standings"]);
  });

  it("gives an admin the same three plus Admin, last", () => {
    expect(tabsFor({ isAdmin: true }).map((t) => t.label)).toEqual(["Home", "Pick", "Standings", "Admin"]);
  });

  it("has no Menu tab yet and no Me tab", () => {
    const labels = tabsFor({ isAdmin: true }).map((t) => t.label);
    expect(labels).not.toContain("Menu");
    expect(labels).not.toContain("Me");
  });

  it("points each tab at its own address", () => {
    expect(tabsFor({ isAdmin: true }).map((t) => t.to)).toEqual(["/", "/pick", "/standings", "/admin"]);
  });
});

describe("activeTab", () => {
  it.each([
    ["/", "home"],
    ["/pick", "pick"],
    ["/pool/p1/entry/e1/pick", "pick"],
    ["/pool/p1/entry/e1/pick/", "pick"],
    ["/standings", "standings"],
    ["/pool/p1", "standings"],
    ["/pool/p1/", "standings"],
    ["/admin", "admin"],
    ["/admin/p1", "admin"],
    ["/admin/schedule", "admin"],
    ["/admin/promotions", "admin"],
  ])("%s highlights %s", (path, expected) => {
    expect(activeTab(path)).toBe(expected);
  });

  it("highlights nothing on the Me page", () => {
    expect(activeTab("/account")).toBeNull();
  });

  it("highlights nothing for an unknown path", () => {
    expect(activeTab("/somewhere/else")).toBeNull();
    expect(activeTab("/pool")).toBeNull();
    expect(activeTab("/administrator")).toBeNull(); // not under /admin
  });
});

describe("pickDestination", () => {
  it("says so when the person has joined no pool", () => {
    expect(pickDestination([])).toEqual({ kind: "none" });
  });

  it("goes straight to the pick screen for one alive entry", () => {
    expect(pickDestination([entry("e1", "p1")])).toEqual({ kind: "redirect", to: "/pool/p1/entry/e1/pick" });
  });

  it("lists the pool, marked out and leading to standings, for one eliminated entry", () => {
    expect(pickDestination([entry("e1", "p1", "eliminated", "Sunday Survivor")])).toEqual({
      kind: "list",
      items: [{ entryId: "e1", poolId: "p1", poolName: "Sunday Survivor", to: "/pool/p1", out: true }],
    });
  });

  it("lists every pool when there are several, alive ones leading to the pick screen", () => {
    const result = pickDestination([entry("e1", "p1", "alive", "Survivor"), entry("e2", "p2", "eliminated", "Pick 'Em")]);
    expect(result).toEqual({
      kind: "list",
      items: [
        { entryId: "e1", poolId: "p1", poolName: "Survivor", to: "/pool/p1/entry/e1/pick", out: false },
        { entryId: "e2", poolId: "p2", poolName: "Pick 'Em", to: "/pool/p2", out: true },
      ],
    });
  });

  it("lists two alive entries rather than guessing", () => {
    const result = pickDestination([entry("e1", "p1"), entry("e2", "p2")]);
    expect(result.kind).toBe("list");
  });
});

describe("standingsDestination", () => {
  it("says so when the person has joined no pool", () => {
    expect(standingsDestination([])).toEqual({ kind: "none" });
  });

  it("goes straight to the standings for one pool, alive or out", () => {
    expect(standingsDestination([entry("e1", "p1")])).toEqual({ kind: "redirect", to: "/pool/p1" });
    expect(standingsDestination([entry("e1", "p1", "eliminated")])).toEqual({ kind: "redirect", to: "/pool/p1" });
  });

  it("lists every pool when there are several, all leading to standings", () => {
    const result = standingsDestination([entry("e1", "p1", "alive", "Survivor"), entry("e2", "p2", "eliminated", "Pick 'Em")]);
    expect(result).toEqual({
      kind: "list",
      items: [
        { entryId: "e1", poolId: "p1", poolName: "Survivor", to: "/pool/p1", out: false },
        { entryId: "e2", poolId: "p2", poolName: "Pick 'Em", to: "/pool/p2", out: true },
      ],
    });
  });
});
