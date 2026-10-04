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
