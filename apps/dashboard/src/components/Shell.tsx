import { Outlet, useLocation } from "react-router";
import { AdminPanelProvider, useAdminPanel } from "./AdminPanelContext";
import { AppHeader } from "./AppHeader";
import { BottomTabs } from "./BottomTabs";
import { matchNav, NAV_LABELS } from "../lib/nav";

export function PageHeader() {
  const { pathname } = useLocation();
  const navKey = matchNav(pathname);
  const { poolName } = useAdminPanel();
  if (!navKey) return null;

  const title = navKey === "pools" && poolName ? `${NAV_LABELS[navKey]} - ${poolName}` : NAV_LABELS[navKey];

  return (
    <h1 className="px-6 pb-6 pt-6 font-display text-2xl font-bold uppercase tracking-wide text-brand-text">
      {title}
    </h1>
  );
}

// The v2 frame: header on top, bottom tabs, and the page between. The bottom padding
// keeps the last line of any page clear of the fixed tab bar.
export function Shell() {
  return (
    <AdminPanelProvider>
      <div className="flex min-h-screen flex-col bg-brand-bg">
        <AppHeader />
        <main className="flex-1 pb-28">
          <PageHeader />
          <Outlet />
        </main>
        <BottomTabs />
      </div>
    </AdminPanelProvider>
  );
}
