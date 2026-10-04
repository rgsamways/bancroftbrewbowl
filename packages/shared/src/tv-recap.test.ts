import { describe, expect, it } from "vitest";
import { recapShareText, sharePercent, type PoolRecap } from "./tv-recap.js";

describe("sharePercent", () => {
  it("rounds to a whole percent and is 0 with no pickers", () => {
    expect(sharePercent(24, 64)).toBe(38);
    expect(sharePercent(1, 3)).toBe(33);
    expect(sharePercent(0, 0)).toBe(0);
  });
});

const recap = (over: Partial<PoolRecap>): PoolRecap => ({
  pool: { id: "p", name: "Sunday Survivor", type: "survivor" },
  week: 4,
  playersTotal: 64,
  playersLeft: 38,
  playersOut: 9,
  mostPicked: { team: "KC", picks: 24, sharePercent: 38 },
  upset: null,
  you: { entryId: "e", survived: true, picks: [{ team: "KC", result: "win" }], correct: null, gamesTotal: null, points: null, rank: null, tied: false },
  leaderPoints: null,
  ...over,
});

describe("recapShareText", () => {
  it("says still alive with the counts, and never names a pick", () => {
    const text = recapShareText(recap({}), "https://bancroftbrewbowl.ca");
    expect(text).toBe("Sunday Survivor: Still alive after week 4: 38 of 64 left. Play at https://bancroftbrewbowl.ca");
    expect(text).not.toContain("KC");
  });

  it("says out when the player is out", () => {
    const you = { ...recap({}).you!, survived: false };
    expect(recapShareText(recap({ you }), "https://x.ca")).toContain("I'm out after week 4.");
  });

  it("pick 'em: correct out of games", () => {
    const you = { ...recap({}).you!, survived: null, correct: 11, gamesTotal: 14 };
    const text = recapShareText(recap({ pool: { id: "p", name: "Pick 'em", type: "pick_em" }, you }), "https://x.ca");
    expect(text).toContain("I got 11 of 14 right in week 4.");
  });
});
