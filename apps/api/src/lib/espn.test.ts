import { describe, expect, it } from "vitest";
import { parseEspnEvents, toTeamCode, type EspnEvent } from "./espn.js";

const event = (
  name: string,
  completed: boolean,
  home: { team: string; score?: string; winner?: boolean },
  away: { team: string; score?: string; winner?: boolean }
): EspnEvent => ({
  name,
  date: "2026-09-13T17:00Z",
  competitions: [
    {
      status: { type: { completed } },
      competitors: [
        { team: { abbreviation: home.team }, homeAway: "home", score: home.score, winner: home.winner },
        { team: { abbreviation: away.team }, homeAway: "away", score: away.score, winner: away.winner },
      ],
    },
  ],
});

describe("parseEspnEvents", () => {
  it("reads a home win, an away win and a tie, with scores", () => {
    const { games, skipped } = parseEspnEvents(
      [
        event("a", true, { team: "KC", score: "27", winner: true }, { team: "BUF", score: "24", winner: false }),
        event("b", true, { team: "DET", score: "10", winner: false }, { team: "NYJ", score: "20", winner: true }),
        event("c", true, { team: "PHI", score: "17", winner: false }, { team: "DAL", score: "17", winner: false }),
      ],
      3
    );
    expect(skipped).toEqual([]);
    expect(games.map((g) => [g.homeTeam, g.awayTeam, g.result, g.homeScore, g.awayScore, g.week, g.final])).toEqual([
      ["KC", "BUF", "home_win", 27, 24, 3, true],
      ["DET", "NYJ", "away_win", 10, 20, 3, true],
      ["PHI", "DAL", "tie", 17, 17, 3, true],
    ]);
  });

  it("a game that is not over is pending with no scores, whatever ESPN lists so far", () => {
    const { games } = parseEspnEvents([event("live", false, { team: "KC", score: "7", winner: true }, { team: "BUF", score: "3" })], 1);
    expect(games[0]).toMatchObject({ final: false, result: "pending", homeScore: null, awayScore: null });
  });

  it("maps Washington's ESPN code and skips a team we don't know", () => {
    expect(toTeamCode("WSH")).toBe("WAS");
    expect(toTeamCode("XYZ")).toBeNull();
    const { games, skipped } = parseEspnEvents(
      [event("ok", true, { team: "WSH", score: "1", winner: true }, { team: "NYG", score: "0" }), event("odd", true, { team: "XYZ" }, { team: "KC" })],
      2
    );
    expect(games.map((g) => g.homeTeam)).toEqual(["WAS"]);
    expect(skipped).toEqual(["odd"]);
  });

  it("copes with an event that has no competition", () => {
    const { games, skipped } = parseEspnEvents([{ name: "empty", date: "2026-09-13T17:00Z", competitions: [] }], 1);
    expect(games).toEqual([]);
    expect(skipped).toEqual(["empty"]);
  });
});

describe("parseEspnEvents: how a game stands for the scoreboard", () => {
  type Side = { team: string; score?: string; winner?: boolean; record?: string };
  const event = (
    status: { name: string; state: string; completed: boolean; shortDetail?: string },
    home: Side,
    away: Side,
    extra: { network?: string } = {}
  ): EspnEvent => ({
    name: `${away.team} at ${home.team}`,
    date: "2026-10-08T00:15Z",
    status: { displayClock: "4:21", period: 3, type: status },
    competitions: [
      {
        status: { type: { ...status } },
        broadcasts: extra.network ? [{ names: [extra.network] }] : [],
        competitors: [
          { team: { abbreviation: home.team }, homeAway: "home", score: home.score, winner: home.winner, records: home.record ? [{ type: "total", summary: home.record }] : [] },
          { team: { abbreviation: away.team }, homeAway: "away", score: away.score, winner: away.winner, records: away.record ? [{ type: "total", summary: away.record }] : [] },
        ],
      },
    ],
  });
  const one = (e: EspnEvent) => parseEspnEvents([e], 5).games[0]!;

  it("an upcoming game has no scores, a blank status, its records and its TV network", () => {
    const g = one(
      event({ name: "STATUS_SCHEDULED", state: "pre", completed: false }, { team: "DAL", score: "0", record: "2-2" }, { team: "NYG", score: "0", record: "1-3" }, { network: "Prime Video" })
    );
    expect(g).toMatchObject({ state: "upcoming", statusText: "", homeScoreNow: null, awayScoreNow: null, homeRecord: "2-2", awayRecord: "1-3", network: "Prime Video", final: false });
  });

  it("a live game shows its score now and ESPN's short status, but has no final score yet", () => {
    const g = one(event({ name: "STATUS_IN_PROGRESS", state: "in", completed: false, shortDetail: "Q3 4:21" }, { team: "DAL", score: "17" }, { team: "NYG", score: "10" }));
    expect(g).toMatchObject({ state: "live", statusText: "Q3 4:21", homeScoreNow: 17, awayScoreNow: 10, homeScore: null, awayScore: null, result: "pending" });
  });

  it("halftime and overtime are live and final as ESPN says", () => {
    expect(one(event({ name: "STATUS_HALFTIME", state: "in", completed: false, shortDetail: "Halftime" }, { team: "KC", score: "14" }, { team: "BUF", score: "13" }))).toMatchObject({ state: "live", statusText: "Halftime" });
    const g = one(event({ name: "STATUS_FINAL_OVERTIME", state: "post", completed: true, shortDetail: "Final/OT" }, { team: "KC", score: "27", winner: true }, { team: "BUF", score: "24" }));
    expect(g).toMatchObject({ state: "final", statusText: "Final/OT", homeScore: 27, awayScore: 24, result: "home_win" });
  });

  it("a postponed or cancelled game is described plainly and counts as not started", () => {
    expect(one(event({ name: "STATUS_POSTPONED", state: "post", completed: false, shortDetail: "Postponed" }, { team: "KC" }, { team: "BUF" }))).toMatchObject({ state: "upcoming", statusText: "Postponed", homeScoreNow: null });
    expect(one(event({ name: "STATUS_CANCELED", state: "post", completed: false }, { team: "KC" }, { team: "BUF" }))).toMatchObject({ state: "upcoming", statusText: "Canceled" });
  });

  it("a weather delay keeps the game live with the delay as its status", () => {
    expect(one(event({ name: "STATUS_DELAYED", state: "in", completed: false, shortDetail: "Delayed" }, { team: "KC", score: "3" }, { team: "BUF", score: "0" }))).toMatchObject({ state: "live", statusText: "Delayed" });
  });

  it("never reads the betting odds, even when ESPN sends them", () => {
    const e = event({ name: "STATUS_SCHEDULED", state: "pre", completed: false }, { team: "DAL" }, { team: "NYG" });
    (e.competitions[0] as unknown as { odds: unknown }).odds = [{ details: "DAL -8.5", overUnder: 44 }];
    expect(JSON.stringify(one(e))).not.toMatch(/8\.5|overUnder|odds/i);
  });
});
