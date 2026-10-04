import { eq } from "drizzle-orm";
import { NFL_TEAMS, type ActivityKind } from "@bbb/shared";
import { db } from "../db/client.js";
import { adminActivity, entries } from "../db/schema.js";

// The record of admin changes. Every admin write route calls `recordActivity` with the
// signed-in admin passed in explicitly, so the record always says who did it (no database
// trigger, which cannot know who is signed in). Nothing here updates or deletes a record.

/** The database, or a transaction on it: pass the transaction when the route has one so the
 * change and its record succeed or fail together. */
export type Executor = Pick<typeof db, "insert" | "select" | "query">;

export type Actor = { id: string; name: string };

/** The acting admin, from the session `requireAdmin` returned. */
export function actorOf(session: { user: { id: string; name: string } }): Actor {
  return { id: session.user.id, name: session.user.name };
}

export async function recordActivity(
  executor: Executor,
  actor: Actor,
  record: { kind: ActivityKind; summary: string; poolId?: string | null; affectsOwnEntry?: boolean }
) {
  await executor.insert(adminActivity).values({
    actorId: actor.id,
    actorName: actor.name,
    kind: record.kind,
    summary: record.summary,
    poolId: record.poolId ?? null,
    affectsOwnEntry: record.affectsOwnEntry ?? false,
  });
}

/** The status of every entry the admin plays, keyed by entry id. Take one before and one after a
 * change that can alter standings, then compare with `ownEntryChanged`. */
export async function ownEntryStatuses(executor: Executor, actorId: string): Promise<Map<string, string>> {
  const rows = await executor.query.entries.findMany({ where: eq(entries.userId, actorId) });
  return new Map(rows.map((e) => [e.id, e.status]));
}

export function ownEntryChanged(before: Map<string, string>, after: Map<string, string>): boolean {
  for (const [id, status] of after) if (before.has(id) && before.get(id) !== status) return true;
  return false;
}

// Plain-English pieces for the sentences.

const nickname = (code: string) => {
  const name = NFL_TEAMS.find((t) => t.code === code)?.name ?? code;
  return name.split(" ").slice(-1)[0] ?? name;
};

export function gameLabel(game: { homeTeam: string; awayTeam: string }) {
  return `${nickname(game.homeTeam)} vs ${nickname(game.awayTeam)}`;
}

export function resultText(game: { homeTeam: string; awayTeam: string }, result: "pending" | "home_win" | "away_win" | "tie") {
  if (result === "home_win") return `${nickname(game.homeTeam)} won`;
  if (result === "away_win") return `${nickname(game.awayTeam)} won`;
  if (result === "tie") return "tied";
  return "no result";
}
