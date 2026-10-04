import { describe, expect, it } from "vitest";
import { activeTab, tabsFor } from "./tabs.js";

describe("tabsFor", () => {
  it("gives a player Home, Pick, Standings and Menu", () => {
    expect(tabsFor({ isAdmin: false }).map((t) => t.label)).toEqual(["Home", "Pick", "Standings", "Menu"]);
  });

  it("gives an admin the same four plus Admin, last", () => {
    expect(tabsFor({ isAdmin: true }).map((t) => t.label)).toEqual(["Home", "Pick", "Standings", "Menu", "Admin"]);
  });

  it("has no Me tab", () => {
    const labels = tabsFor({ isAdmin: true }).map((t) => t.label);
    expect(labels).not.toContain("Me");
  });

  it("points each tab at its own address", () => {
    expect(tabsFor({ isAdmin: true }).map((t) => t.to)).toEqual(["/", "/pick", "/standings", "/menu", "/admin"]);
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
    ["/menu", "menu"],
    ["/menu/kitchen", "menu"],
    ["/menu/", "menu"],
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
    expect(activeTab("/menus")).toBeNull(); // not under /menu
  });
});
