// The logic behind the bottom tab bar, kept free of React so it can be tested
// directly. The components only render what these functions decide.
// See openspec/changes/v2-shell (the `app-shell` spec).

export type TabKey = "home" | "play" | "menu" | "admin";

export type Tab = { key: TabKey; label: string; to: string };

/** The tabs a person sees, in order. Admin comes last and only for admins; it is a
 * shortcut, since the server decides what an admin may actually do. */
export function tabsFor({ isAdmin }: { isAdmin: boolean }): Tab[] {
  const tabs: Tab[] = [
    { key: "home", label: "Home", to: "/" },
    { key: "play", label: "Play", to: "/play" },
    { key: "menu", label: "Menu", to: "/menu" },
  ];
  if (isAdmin) tabs.push({ key: "admin", label: "Admin", to: "/admin" });
  return tabs;
}

/** Which tab a path belongs to, or null when none should be highlighted (the Me
 * page, or anything unrecognised). */
export function activeTab(pathname: string): TabKey | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/") return "home";
  if (path === "/play" || path === "/pick" || path === "/standings" || /^\/pool\/[^/]+(\/|$)/.test(path)) return "play";
  if (path === "/menu" || path.startsWith("/menu/")) return "menu";
  if (path === "/admin" || path.startsWith("/admin/")) return "admin";
  return null;
}

export type PlaySection = "games" | "pools" | "leagues";

/** The sections of Play that have something to open, in order. Games and Leagues have no
 * content yet, so today this is just Pools; the section bar is drawn only when there are
 * two or more. */
export function playSections(has: { games: boolean; pools: boolean; leagues: boolean }): PlaySection[] {
  const all: PlaySection[] = [];
  if (has.games) all.push("games");
  if (has.pools) all.push("pools");
  if (has.leagues) all.push("leagues");
  return all;
}

/** The pool screens, in order. A third (Stats) is one more item here once it has content. */
export type PoolScreen = "pick" | "standings";
