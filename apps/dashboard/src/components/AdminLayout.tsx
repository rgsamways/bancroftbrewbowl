import { Link, Navigate, Outlet, useLocation } from "react-router";
import { Beer, Ellipsis, ClipboardCheck, Layers, ListChecks, type LucideIcon } from "lucide-react";
import { AppHeader } from "./AppHeader";
import { PageHeader } from "./Shell";
import { useSession, type AppUser } from "../lib/auth-client";

// The admin side of the app: its own header and bottom bar (Next step, Results, Pools, More)
// instead of the player bar. Task screens (results one at a time, the wipeout decision) use
// FocusLayout, which has no bar at all. A person who is not an admin is sent home; the server
// is what really enforces admin access.

/** Renders its routes only for an admin, otherwise sends the person to the player Home. */
export function RequireAdmin() {
  const { data: session } = useSession();
  const isAdmin = Boolean((session?.user as AppUser | undefined)?.isAdmin);
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />;
}

type AdminTabKey = "next" | "results" | "menu" | "pools" | "more";

const ADMIN_TABS: { key: AdminTabKey; label: string; to: string; icon: LucideIcon }[] = [
  { key: "next", label: "Next step", to: "/admin", icon: ListChecks },
  { key: "results", label: "Results", to: "/admin/results", icon: ClipboardCheck },
  { key: "menu", label: "Menu", to: "/admin/menu", icon: Beer },
  { key: "pools", label: "Pools", to: "/admin/pools", icon: Layers },
  { key: "more", label: "More", to: "/admin/more", icon: Ellipsis },
];

/** Which admin tab a path belongs to. */
export function activeAdminTab(pathname: string): AdminTabKey | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/admin") return "next";
  if (path === "/admin/results" || path.startsWith("/admin/results/")) return "results";
  if (path === "/admin/menu" || path.startsWith("/admin/menu/") || path.startsWith("/admin/music/")) return "menu";
  if (path === "/admin/pools" || path.startsWith("/admin/pools/")) return "pools";
  if (path === "/admin/more" || path === "/admin/activity" || path === "/admin/brewery" || path.startsWith("/admin/brewery/")) return "more";
  return null;
}

function AdminTabs() {
  const { pathname } = useLocation();
  const current = activeAdminTab(pathname);
  return (
    <nav
      aria-label="Admin"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-border bg-brand-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {ADMIN_TABS.map(({ key, label, to, icon: Icon }) => (
          <li key={key}>
            <Link
              to={to}
              aria-current={key === current ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                key === current ? "text-brand-accent" : "text-brand-muted"
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AdminLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-brand-bg">
        <AppHeader />
        <main className="flex-1 pb-28">
          <PageHeader />
          <Outlet />
        </main>
        <AdminTabs />
    </div>
  );
}

/** For task screens: no header, no bar. Each screen draws its own Back / Step / Leave row. */
export function FocusLayout() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-brand-bg px-6 pb-10">
      <Outlet />
    </div>
  );
}

/** The top row of a task screen: Back, an optional "Step N of M", and Leave. */
export function FocusBar({
  label,
  onBack,
  leaveTo = "/admin",
}: {
  label?: string;
  onBack?: () => void;
  leaveTo?: string;
}) {
  return (
    <div className="flex min-h-16 items-center justify-between">
      {onBack ? (
        <button type="button" onClick={onBack} className="min-h-11 min-w-11 text-left text-sm font-semibold text-brand-muted">
          Back
        </button>
      ) : (
        <span className="min-w-11" />
      )}
      {label && <span className="text-sm text-brand-muted">{label}</span>}
      <Link to={leaveTo} className="flex min-h-11 min-w-11 items-center justify-end text-sm font-semibold text-brand-muted">
        Leave
      </Link>
    </div>
  );
}
