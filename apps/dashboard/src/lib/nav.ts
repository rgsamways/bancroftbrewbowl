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

export type PageHelp = { title: string; body: string };

// Powers the "?" button in the mobile top bar (opens the right drawer with
// this content). Covers every route, not just the ones in the left nav —
// matchNav is scoped to nav-menu highlighting and returns null for routes
// like pool standings or the pick screen, but the help button is visible on
// every page.
export function getPageHelp(pathname: string): PageHelp | null {
  if (pathname === "/") {
    return {
      title: "Home",
      body: "Every pool you've joined or can join, this week's NFL games, and any promotions running this week.",
    };
  }
  if (pathname === "/account") {
    return {
      title: "Account",
      body: "Update your name or email. Changes apply across every pool and season instantly — nothing is copied per-pool.",
    };
  }
  if (pathname.endsWith("/pick")) {
    return {
      title: "Make Your Pick",
      body: "Choose a team for the current week. You can't reuse a team you've already picked (unless the pool allows it), and picks lock once the first game of the week kicks off.",
    };
  }
  if (pathname.startsWith("/pool/")) {
    return {
      title: "Pool Standings",
      body: "Who's still alive and who's been eliminated in this pool, week by week.",
    };
  }
  if (pathname === "/admin/schedule") {
    return {
      title: "Schedule",
      body: "Enter game results and scores for the season. A result applies to every pool running that season at once, not just one.",
    };
  }
  if (pathname === "/admin/promotions") {
    return {
      title: "Promotions",
      body: "Set up promotions for a specific week — they'll show on the Home page for anyone signed in during that week.",
    };
  }
  if (pathname.startsWith("/admin")) {
    return {
      title: "Pools",
      body: "Create and manage survivor pools. Select a pool from the list to manage its games, entries, and picks, or use the cog button to edit its settings.",
    };
  }
  return null;
}
