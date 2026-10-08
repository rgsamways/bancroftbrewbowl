import { describe, expect, it } from "vitest";
import { activeTab, playSections, tabsFor } from "./tabs.js";

describe("tabsFor", () => {
  it("gives a player Home, Play and Menu", () => {
    expect(tabsFor({ isAdmin: false }).map((t) => t.label)).toEqual(["Home", "Play", "Menu"]);
  });

  it("gives an admin the same three plus Admin, last", () => {
    expect(tabsFor({ isAdmin: true }).map((t) => t.label)).toEqual(["Home", "Play", "Menu", "Admin"]);
  });

  it("has no Me tab", () => {
    const labels = tabsFor({ isAdmin: true }).map((t) => t.label);
    expect(labels).not.toContain("Me");
  });

  it("points each tab at its own address", () => {
    expect(tabsFor({ isAdmin: true }).map((t) => t.to)).toEqual(["/", "/play", "/menu", "/admin"]);
  });
});

describe("activeTab", () => {
  it.each([
    ["/", "home"],
    ["/pick", "play"],
    ["/play", "play"],
    ["/pool/p1/entry/e1/pick", "play"],
    ["/pool/p1/entry/e1/pick/", "play"],
    ["/standings", "play"],
    ["/pool/p1", "play"],
    ["/pool/p1/recap", "play"],
    ["/pool/p1/", "play"],
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

describe("playSections", () => {
  it("shows only Pools while Games and Leagues are empty", () => {
    expect(playSections({ games: false, pools: true, leagues: false })).toEqual(["pools"]);
  });

  it("lists every section with content, in order", () => {
    expect(playSections({ games: true, pools: true, leagues: true })).toEqual(["games", "pools", "leagues"]);
    expect(playSections({ games: true, pools: true, leagues: false })).toEqual(["games", "pools"]);
  });

  it("shows nothing when nothing has content", () => {
    expect(playSections({ games: false, pools: false, leagues: false })).toEqual([]);
  });
});
