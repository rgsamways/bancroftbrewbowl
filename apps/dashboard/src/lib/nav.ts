export type NavKey = "home" | "schedule" | "pools" | "promotions" | "account";

export const NAV_LABELS: Record<NavKey, string> = {
  home: "Home",
  schedule: "Schedule",
  pools: "Pools",
  promotions: "Promotions",
  account: "Account",
};

// Shared by the Sidebar (for active-link highlighting) and the shared page
// header (for the title), so the two never drift out of sync as more pages
// get added.
export function matchNav(pathname: string): NavKey | null {
  if (pathname === "/") return "home";
  if (pathname === "/account") return "account";
  if (pathname === "/admin/schedule") return "schedule";
  if (pathname === "/admin/promotions") return "promotions";
  if (pathname.startsWith("/admin")) return "pools";
  return null;
}
