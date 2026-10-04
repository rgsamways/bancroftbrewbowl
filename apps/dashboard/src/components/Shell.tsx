import { Link, Outlet, useLocation } from "react-router";
import { AdminPanelProvider, useAdminPanel } from "./AdminPanelContext";
import { AppHeader } from "./AppHeader";
import { BottomTabs } from "./BottomTabs";
import { matchNav, NAV_LABELS } from "../lib/nav";

function PageHeader() {
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

// A stopgap: the old sidebar was the only link to the admin Schedule and Promotions
// pages, so admin pages carry these four links until the step-by-step admin
// slice replaces this.
const ADMIN_LINKS = [
  { to: "/admin", label: "Pools", key: "pools" },
  { to: "/admin/schedule", label: "Schedule", key: "schedule" },
  { to: "/admin/promotions", label: "Promotions", key: "promotions" },
  { to: "/admin/activity", label: "Activity", key: "activity" },
] as const;

function AdminSubNav() {
  const { pathname } = useLocation();
  const current = matchNav(pathname);
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-3">
      <div className="grid grid-cols-4 gap-1.5 rounded-xl border border-brand-border bg-brand-surface p-1">
        {ADMIN_LINKS.map((link) => (
          <Link
            key={link.key}
            to={link.to}
            aria-current={current === link.key ? "page" : undefined}
            className={`flex min-h-11 items-center justify-center rounded-lg text-sm font-medium ${
              current === link.key
                ? "bg-brand-accent-soft text-brand-text ring-1 ring-brand-accent/50"
                : "text-brand-muted"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// The v2 frame: header on top, bottom tabs, and the page between. The bottom padding
// keeps the last line of any page clear of the fixed tab bar.
export function Shell() {
  const { pathname } = useLocation();
  return (
    <AdminPanelProvider>
      <div className="flex min-h-screen flex-col bg-brand-bg">
        <AppHeader />
        {pathname.startsWith("/admin") && <AdminSubNav />}
        <main className="flex-1 pb-28">
          <PageHeader />
          <Outlet />
        </main>
        <BottomTabs />
      </div>
    </AdminPanelProvider>
  );
}
