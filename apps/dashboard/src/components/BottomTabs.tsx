import { Link, useLocation } from "react-router";
import { Beer, House, ShieldCheck, Target, Trophy, type LucideIcon } from "lucide-react";
import { useAccess } from "../lib/useAccess";
import { activeTab, tabsFor, type TabKey } from "../lib/tabs";

const ICONS: Record<TabKey, LucideIcon> = {
  home: House,
  pick: Target,
  standings: Trophy,
  menu: Beer,
  admin: ShieldCheck,
};

// The fixed bottom bar. Which tabs, and which is current, is decided by the pure
// functions in lib/tabs.ts; this only draws them. The Admin tab is a shortcut shown
// to admins; the server is what actually enforces admin access.
export function BottomTabs() {
  const { pathname } = useLocation();
  const { isAdmin } = useAccess();
  const tabs = tabsFor({ isAdmin });
  const current = activeTab(pathname);

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-border bg-brand-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => {
          const Icon = ICONS[tab.key];
          const active = tab.key === current;
          return (
            <li key={tab.key}>
              <Link
                to={tab.to}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  active ? "text-brand-accent" : "text-brand-muted"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
