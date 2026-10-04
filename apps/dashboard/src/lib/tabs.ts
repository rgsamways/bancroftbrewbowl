// The logic behind the bottom tab bar, kept free of React so it can be tested
// directly. The components only render what these functions decide.
// See openspec/changes/v2-shell (the `app-shell` spec).

export type TabKey = "home" | "pick" | "standings" | "admin";

export type Tab = { key: TabKey; label: string; to: string };

/** The tabs a person sees, in order. Admin comes last and only for admins; it is a
 * shortcut, since the server decides what an admin may actually do. There is no
 * Menu tab until a menu exists. */
export function tabsFor({ isAdmin }: { isAdmin: boolean }): Tab[] {
  const tabs: Tab[] = [
    { key: "home", label: "Home", to: "/" },
    { key: "pick", label: "Pick", to: "/pick" },
    { key: "standings", label: "Standings", to: "/standings" },
  ];
  if (isAdmin) tabs.push({ key: "admin", label: "Admin", to: "/admin" });
  return tabs;
}

/** Which tab a path belongs to, or null when none should be highlighted (the Me
 * page, or anything unrecognised). */
export function activeTab(pathname: string): TabKey | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/") return "home";
  if (path === "/pick" || /^\/pool\/[^/]+\/entry\/[^/]+\/pick$/.test(path)) return "pick";
  if (path === "/standings" || /^\/pool\/[^/]+$/.test(path)) return "standings";
  if (path === "/admin" || path.startsWith("/admin/")) return "admin";
  return null;
}
