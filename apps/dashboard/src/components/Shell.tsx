import { Outlet, useLocation } from "react-router";
import { AppHeader } from "./AppHeader";
import { BottomTabs } from "./BottomTabs";
import { NoticeBanner } from "./NoticeBanner";
import { matchNav, NAV_LABELS } from "../lib/nav";

export function PageHeader() {
  const { pathname } = useLocation();
  const navKey = matchNav(pathname);
  if (!navKey) return null;

  const title = NAV_LABELS[navKey];

  return (
    <div className="mx-auto max-w-lg px-6 pb-6 pt-6">
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-brand-text">{title}</h1>
    </div>
  );
}

// The v2 frame: header on top, bottom tabs, and the page between. The bottom padding
// keeps the last line of any page clear of the fixed tab bar.
export function Shell() {
  return (
    <div className="flex min-h-screen flex-col bg-brand-bg">
        <AppHeader />
        <main className="flex-1 pb-28">
          <NoticeBanner />
          <PageHeader />
          <Outlet />
        </main>
        <BottomTabs />
    </div>
  );
}
