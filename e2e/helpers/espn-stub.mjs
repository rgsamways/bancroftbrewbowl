// A stand-in for ESPN's scoreboard, so the browser tests never contact the real service.
// The API is started with ESPN_BASE_URL pointing here. Tests set what ESPN "says" by POSTing to
// /__set: { mode: "ok" | "down", games: [{ week, home, away, final, homeScore, awayScore, date? }] }.
import http from "node:http";
import process from "node:process";
import { URL } from "node:url";
import console from "node:console";

const port = Number(process.env.ESPN_STUB_PORT ?? 3021);
let state = { mode: "ok", games: [] };

const event = (g) => ({
  name: `${g.away} at ${g.home}`,
  date: g.date ?? "2026-09-13T17:00Z",
  competitions: [
    {
      status: { type: { completed: Boolean(g.final) } },
      competitors: [
        { team: { abbreviation: g.home }, homeAway: "home", score: String(g.homeScore ?? 0), winner: Boolean(g.final) && g.homeScore > g.awayScore },
        { team: { abbreviation: g.away }, homeAway: "away", score: String(g.awayScore ?? 0), winner: Boolean(g.final) && g.awayScore > g.homeScore },
      ],
    },
  ],
});

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    if (url.pathname === "/health") return res.end("ok");
    if (url.pathname === "/__set" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        state = JSON.parse(body);
        res.end("set");
      });
      return;
    }
    if (url.pathname.endsWith("/scoreboard")) {
      if (state.mode === "down") {
        res.statusCode = 500;
        return res.end("down");
      }
      const week = Number(url.searchParams.get("week"));
      res.setHeader("content-type", "application/json");
      return res.end(JSON.stringify({ events: state.games.filter((g) => g.week === week).map(event) }));
    }
    res.statusCode = 404;
    res.end("not found");
  })
  .listen(port, () => console.log(`ESPN stub on ${port}`));
