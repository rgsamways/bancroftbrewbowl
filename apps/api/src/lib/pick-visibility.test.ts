import { describe, expect, it } from "vitest";
import { visiblePicks, type Viewer } from "./pick-visibility.js";

const ALICE = "user-alice";
const BOB = "user-bob";
const ADMIN = "user-admin";

const player = (userId: string): Viewer => ({ userId, isAdmin: false });
const admin: Viewer = { userId: ADMIN, isAdmin: true };

// Week 1 has locked; week 2 has not.
const locked = new Set([1]);

const pick = (entryId: string, ownerUserId: string | null, weekNumber: number, teamCode = "KC") => ({
  id: `${entryId}-${weekNumber}`,
  entryId,
  ownerUserId,
  weekNumber,
  teamCode,
  result: "pending",
});

describe("visiblePicks", () => {
  describe("your own picks", () => {
    it("are always shown in full, locked or not", () => {
      const rows = [pick("a1", ALICE, 1), pick("a1", ALICE, 2)];
      const seen = visiblePicks(rows, player(ALICE), locked);
      expect(seen).toHaveLength(2);
      expect(seen.map((p) => p.weekNumber)).toEqual([1, 2]);
      expect(seen.every((p) => "teamCode" in p && p.teamCode === "KC")).toBe(true);
    });

    it("never include the owner field in what is returned", () => {
      const [seen] = visiblePicks([pick("a1", ALICE, 1)], player(ALICE), locked);
      expect(seen).not.toHaveProperty("ownerUserId");
    });

    it("keep every other field the route sent, such as the pick's id", () => {
      const [seen] = visiblePicks([pick("a1", ALICE, 2)], player(ALICE), locked);
      expect(seen).toMatchObject({ id: "a1-2", entryId: "a1", weekNumber: 2, teamCode: "KC", result: "pending" });
    });
  });

  describe("someone else's picks, as an ordinary player", () => {
    it("are shown in full once the week has locked", () => {
      const seen = visiblePicks([pick("a1", ALICE, 1)], player(BOB), locked);
      expect(seen).toEqual([{ id: "a1-1", entryId: "a1", weekNumber: 1, teamCode: "KC", result: "pending" }]);
    });

    it("are not shown at all before the week locks, not even as a marker", () => {
      expect(visiblePicks([pick("a1", ALICE, 2)], player(BOB), locked)).toEqual([]);
    });

    it("show the locked weeks and omit the unlocked one when a player has both", () => {
      const rows = [pick("a1", ALICE, 1), pick("a1", ALICE, 2)];
      const seen = visiblePicks(rows, player(BOB), locked);
      expect(seen.map((p) => p.weekNumber)).toEqual([1]);
    });
  });

  describe("someone else's picks, as an admin", () => {
    it("are shown in full once the week has locked", () => {
      const seen = visiblePicks([pick("a1", ALICE, 1)], admin, locked);
      expect(seen).toEqual([{ id: "a1-1", entryId: "a1", weekNumber: 1, teamCode: "KC", result: "pending" }]);
    });

    it("become a marker with no team and no result before the week locks", () => {
      const seen = visiblePicks([pick("a1", ALICE, 2, "BUF")], admin, locked);
      expect(seen).toEqual([{ entryId: "a1", weekNumber: 2, teamCode: null, result: null, submitted: true }]);
      expect(JSON.stringify(seen)).not.toContain("BUF");
    });

    it("do not leak the pick's id or any other field in the marker", () => {
      const [marker] = visiblePicks([pick("a1", ALICE, 2)], admin, locked);
      expect(Object.keys(marker!).sort()).toEqual(["entryId", "result", "submitted", "teamCode", "weekNumber"]);
    });
  });

  describe("an admin who also plays", () => {
    it("sees their own picks in full and only a marker for everyone else's unlocked picks", () => {
      const rows = [pick("me", ADMIN, 2, "PHI"), pick("a1", ALICE, 2, "BUF"), pick("b1", BOB, 2, "DAL")];
      const seen = visiblePicks(rows, admin, locked);
      expect(seen).toHaveLength(3);
      expect(seen[0]).toMatchObject({ entryId: "me", teamCode: "PHI", result: "pending" });
      expect(seen[1]).toEqual({ entryId: "a1", weekNumber: 2, teamCode: null, result: null, submitted: true });
      expect(seen[2]).toEqual({ entryId: "b1", weekNumber: 2, teamCode: null, result: null, submitted: true });
    });
  });

  describe("an entry nobody owns yet", () => {
    it("is treated as someone else's: hidden before the lock, shown after", () => {
      const rows = [pick("x1", null, 1), pick("x1", null, 2)];
      expect(visiblePicks(rows, player(ALICE), locked).map((p) => p.weekNumber)).toEqual([1]);
      expect(visiblePicks(rows, admin, locked).map((p) => ("submitted" in p ? "marker" : "full"))).toEqual(["full", "marker"]);
    });

    it("is never mistaken for the viewer's own entry", () => {
      // A null owner must not match any viewer, even one whose id is somehow empty.
      const seen = visiblePicks([pick("x1", null, 2)], { userId: "", isAdmin: false }, locked);
      expect(seen).toEqual([]);
    });
  });

  describe("edge cases", () => {
    it("returns nothing for no rows", () => {
      expect(visiblePicks([], player(ALICE), locked)).toEqual([]);
    });

    it("shows nothing for another player's picks when no week has locked", () => {
      const rows = [pick("a1", ALICE, 1), pick("a1", ALICE, 2)];
      expect(visiblePicks(rows, player(BOB), new Set())).toEqual([]);
    });

    it("shows everything once every week has locked", () => {
      const rows = [pick("a1", ALICE, 1), pick("a1", ALICE, 2), pick("b1", BOB, 2)];
      expect(visiblePicks(rows, player(BOB), new Set([1, 2]))).toHaveLength(3);
    });

    it("keeps the order of the rows it keeps", () => {
      const rows = [pick("a1", ALICE, 2), pick("b1", BOB, 1), pick("a1", ALICE, 1)];
      const seen = visiblePicks(rows, admin, locked);
      expect(seen.map((p) => `${p.entryId}:${p.weekNumber}`)).toEqual(["a1:2", "b1:1", "a1:1"]);
    });

    it("does not change the rows it was given", () => {
      const rows = [pick("a1", ALICE, 2)];
      const before = JSON.stringify(rows);
      visiblePicks(rows, admin, locked);
      expect(JSON.stringify(rows)).toBe(before);
    });
  });
});

describe("visiblePicks with a per-pick test (a pool that reveals each pick as its game starts)", () => {
  const started = (row: { weekNumber: number; teamCode: string }) => row.teamCode === "KC";
  const rows = [pick("a", BOB, 1, "KC"), pick("a2", BOB, 1, "DET")];

  it("shows another player only the picks whose game has started; an admin sees the others as picked", () => {
    const forPlayer = visiblePicks(rows, player(ALICE), started);
    expect(forPlayer.map((r) => ("teamCode" in r ? r.teamCode : null))).toEqual(["KC"]);
    const forAdmin = visiblePicks(rows, admin, started);
    expect(forAdmin).toHaveLength(2);
    expect(forAdmin[1]).toMatchObject({ teamCode: null, submitted: true });
  });

  it("always shows a player their own picks", () => {
    expect(visiblePicks(rows, player(BOB), () => false)).toHaveLength(2);
  });
});
