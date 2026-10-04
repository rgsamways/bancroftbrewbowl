export type NavKey = "schedule" | "pools" | "promotions" | "activity" | "account";

export const NAV_LABELS: Record<NavKey, string> = {
  schedule: "Schedule",
  pools: "Pools",
  promotions: "Promotions",
  activity: "Activity",
  account: "Account",
};

// Used by the shared page header (for the title) and the interim admin links (for
// the current one). The bottom tabs use lib/tabs.ts instead.
export function matchNav(pathname: string): NavKey | null {
  if (pathname === "/account") return "account";
  if (pathname === "/admin/schedule") return "schedule";
  if (pathname === "/admin/promotions") return "promotions";
  if (pathname === "/admin/activity") return "activity";
  if (pathname.startsWith("/admin")) return "pools";
  return null;
}
