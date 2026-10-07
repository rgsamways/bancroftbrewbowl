import { asc, desc, eq, gte, sql } from "drizzle-orm";
import {
  BREWERY_KINDS,
  bucketOf,
  easternToday,
  scheduleText,
  specialIsOver,
  specialShowsOn,
  type BreweryHome,
  type BreweryItem,
  type BreweryKind,
  type MenuKind,
  type SpecialTag,
} from "@bbb/shared";
import { db } from "../db/client.js";
import { games, menuItems, musicEvents, promotions } from "../db/schema.js";
import { currentWeek, loadSeasonWeeks } from "./entry-state.js";

// What is showing at the brewery right now. "Now" is the current week of the latest season that
// has games (the same definition the admin summary uses) and today's date in Eastern time.

export type SeasonWeekNow = { seasonYear: number; weekNumber: number } | null;

export async function currentSeasonWeek(): Promise<SeasonWeekNow> {
  const [latest] = await db.select({ year: sql<number>`max(${games.seasonYear})::int` }).from(games);
  if (!latest?.year) return null;
  const week = currentWeek((await loadSeasonWeeks([latest.year])).get(latest.year) ?? []);
  return week ? { seasonYear: latest.year, weekNumber: week.weekNumber } : null;
}

type Row = typeof promotions.$inferSelect;

const hm = (t: string | null) => (t ? t.slice(0, 5) : null);
const scheduleOf = (r: Row) => ({ days: r.days, date: r.onDate, startTime: hm(r.startTime), endTime: hm(r.endTime) });

/** An announcement shows during its week only; a feature during its week or, with no week,
 * until replaced; a special on its days (a one-day special until its date has gone). */
function isShowingNow(r: Row, now: SeasonWeekNow, today: string): boolean {
  // Site notices share the table but are not From the brewery items.
  if (!(BREWERY_KINDS as readonly string[]).includes(r.kind)) return false;
  if (r.kind === "special") return !specialIsOver(scheduleOf(r), today);
  const thisWeek = now !== null && r.seasonYear === now.seasonYear && r.weekNumber === now.weekNumber;
  if (r.kind === "feature") return r.weekNumber === null || thisWeek;
  // An announcement for a week still to come is "showing now" for the admin list but not on Home.
  return now !== null && r.seasonYear === now.seasonYear && r.weekNumber !== null && r.weekNumber >= now.weekNumber;
}

export async function loadBreweryHome(date = new Date()): Promise<BreweryHome> {
  const today = easternToday(date);
  const now = await currentSeasonWeek();
  const rows = await db.query.promotions.findMany({ orderBy: [desc(promotions.createdAt)] });

  const featureRow = rows.find((r) => r.kind === "feature" && isShowingNow(r, now, today));
  let featured: BreweryHome["featured"] = null;
  if (featureRow?.menuItemId) {
    const item = await db.query.menuItems.findFirst({ where: eq(menuItems.id, featureRow.menuItemId) });
    if (item?.available) {
      featured = { id: item.id, name: item.name, kind: item.kind as MenuKind, style: item.style, abv: item.abv, priceCents: item.priceCents };
    }
  }

  const specials = rows
    .filter((r) => r.kind === "special" && isShowingNow(r, now, today) && specialShowsOn(scheduleOf(r), today))
    .reverse()
    .map((r) => ({ id: r.id, title: r.title, details: r.description || null, tag: (r.tag as SpecialTag | null) ?? null, when: scheduleText(scheduleOf(r)) }));

  const announcementRow = rows.find(
    (r) => r.kind === "announcement" && now !== null && r.seasonYear === now.seasonYear && r.weekNumber === now.weekNumber
  );
  // The first music event this weekend, by the same rule the Music tab uses.
  const upcoming = await db.query.musicEvents.findMany({
    where: gte(musicEvents.eventDate, today),
    orderBy: [asc(musicEvents.eventDate), asc(musicEvents.startTime), asc(musicEvents.title)],
    limit: 20,
  });
  const liveRow = upcoming.find((e) => bucketOf(e.eventDate, today) === "thisWeekend");
  const live = liveRow
    ? { id: liveRow.id, title: liveRow.title, date: liveRow.eventDate, startTime: hm(liveRow.startTime), endTime: hm(liveRow.endTime) }
    : null;

  return {
    live,
    featured,
    specials,
    announcement: announcementRow ? { title: announcementRow.title, message: announcementRow.description } : null,
  };
}

/** Everything the admin "Showing now" list shows. */
export async function loadShowingNow(date = new Date()): Promise<BreweryItem[]> {
  const today = easternToday(date);
  const now = await currentSeasonWeek();
  const rows = await db.query.promotions.findMany({ orderBy: [asc(promotions.createdAt)] });
  const kindOrder: BreweryKind[] = ["feature", "special", "announcement"];
  return rows
    .filter((r) => isShowingNow(r, now, today))
    .sort((a, b) => kindOrder.indexOf(a.kind as BreweryKind) - kindOrder.indexOf(b.kind as BreweryKind))
    .map((r) => ({
      id: r.id,
      kind: r.kind as BreweryKind,
      title: r.title,
      detail:
        r.kind === "feature"
          ? r.weekNumber === null
            ? "Until changed"
            : "This week"
          : r.kind === "special"
            ? scheduleText(scheduleOf(r))
            : `Week ${r.weekNumber}`,
    }));
}
