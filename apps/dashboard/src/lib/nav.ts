export type NavKey = "promotions" | "activity" | "account";

export const NAV_LABELS: Record<NavKey, string> = {
  promotions: "Promotions",
  activity: "Activity",
  account: "Account",
};

// Used by the shared page header for the title of pages that do not draw their own. The
// player tabs use lib/tabs.ts and the admin tabs use components/AdminLayout.tsx.
export function matchNav(pathname: string): NavKey | null {
  if (pathname === "/account") return "account";
  if (pathname === "/admin/promotions") return "promotions";
  if (pathname === "/admin/activity") return "activity";
  return null;
}
