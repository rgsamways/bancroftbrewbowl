import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { games } from "../db/schema.js";
import { fetchEspnWeek, type EspnGame } from "./espn.js";

// Loading a season's regular-season schedule from ESPN, from a screen. It adds games that are not
// here yet (always as undecided) and updates the kickoff of games that have not started. It never
// sets or changes a result, and never touches a game that has started or has a result: results only
// come through "Check for results", which scores them.

const WEEKS = 18;
const SAME_TIME_MS = 60_000;

export type ScheduleWeekPreview = { week: number; toAdd: number; moved: number };
export type ScheduleMove = { week: number; homeTeam: string; awayTeam: string; from: string; to: string };
export type SchedulePreview = {
  seasonYear: number;
  weeks: ScheduleWeekPreview[];
  totals: { toAdd: number; moved: number; unchanged: number };
  moved: ScheduleMove[];
};

const keyOf = (home: string, away: string) => `${home}|${away}`;

async function readSeason(seasonYear: number) {
  const espnByWeek = new Map<number, EspnGame[]>();
  for (let week = 1; week <= WEEKS; week++) espnByWeek.set(week, await fetchEspnWeek(seasonYear, week));
  const ours = await db.select().from(games).where(eq(games.seasonYear, seasonYear));
  return { espnByWeek, ours };
}

function diff(seasonYear: number, espnByWeek: Map<number, EspnGame[]>, ours: (typeof games.$inferSelect)[], now: Date) {
  const mine = new Map(ours.map((g) => [`${g.weekNumber}|${keyOf(g.homeTeam, g.awayTeam)}`, g]));
  const toAdd: EspnGame[] = [];
  const moves: { id: string; move: ScheduleMove; to: Date }[] = [];
  let unchanged = 0;
  for (const [week, list] of espnByWeek) {
    for (const g of list) {
      const existing = mine.get(`${week}|${keyOf(g.homeTeam, g.awayTeam)}`);
      if (!existing) {
        if (!Number.isNaN(g.kickoff.getTime())) toAdd.push(g);
        continue;
      }
      const started = existing.result !== "pending" || new Date(existing.kickoffTime) <= now;
      const differs = Math.abs(g.kickoff.getTime() - new Date(existing.kickoffTime).getTime()) > SAME_TIME_MS;
      if (!started && differs && !Number.isNaN(g.kickoff.getTime())) {
        moves.push({
          id: existing.id,
          to: g.kickoff,
          move: { week, homeTeam: g.homeTeam, awayTeam: g.awayTeam, from: new Date(existing.kickoffTime).toISOString(), to: g.kickoff.toISOString() },
        });
      } else {
        unchanged++;
      }
    }
  }
  return { toAdd, moves, unchanged, seasonYear };
}

/** What loading the season would do. Writes nothing. Throws EspnError if ESPN cannot be read. */
export async function previewScheduleLoad(seasonYear: number, now: Date = new Date()): Promise<SchedulePreview> {
  const { espnByWeek, ours } = await readSeason(seasonYear);
  const d = diff(seasonYear, espnByWeek, ours, now);
  const weeks: ScheduleWeekPreview[] = [];
  for (let week = 1; week <= WEEKS; week++) {
    const toAdd = d.toAdd.filter((g) => g.week === week).length;
    const moved = d.moves.filter((m) => m.move.week === week).length;
    if (toAdd > 0 || moved > 0) weeks.push({ week, toAdd, moved });
  }
  return {
    seasonYear,
    weeks,
    totals: { toAdd: d.toAdd.length, moved: d.moves.length, unchanged: d.unchanged },
    moved: d.moves.map((m) => m.move),
  };
}

export type ScheduleApplyOutcome = { added: number; moved: ScheduleMove[] };

/** Does it: reads ESPN again itself, inserts new games as undecided and moves kickoffs of games that
 * have not started. Never writes a result or touches a started game. */
export async function applyScheduleLoad(seasonYear: number, now: Date = new Date()): Promise<ScheduleApplyOutcome> {
  const { espnByWeek, ours } = await readSeason(seasonYear);
  const d = diff(seasonYear, espnByWeek, ours, now);

  let added = 0;
  for (const g of d.toAdd) {
    const inserted = await db
      .insert(games)
      .values({ seasonYear, weekNumber: g.week, homeTeam: g.homeTeam, awayTeam: g.awayTeam, kickoffTime: g.kickoff, result: "pending" })
      .onConflictDoNothing()
      .returning({ id: games.id });
    added += inserted.length;
  }
  const moved: ScheduleMove[] = [];
  for (const m of d.moves) {
    // Only a still-undecided game is written, so a result entered meanwhile is never disturbed.
    const [saved] = await db
      .update(games)
      .set({ kickoffTime: m.to })
      .where(and(eq(games.id, m.id), eq(games.result, "pending")))
      .returning({ id: games.id });
    if (saved) moved.push(m.move);
  }
  return { added, moved };
}
