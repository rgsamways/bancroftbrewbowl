import { Outlet, useLocation } from "react-router";
import { Menu, Settings } from "lucide-react";
import { MobileNavProvider, useMobileNav } from "./MobileNavContext";
import { RightPanelProvider, useRightPanel } from "./RightPanelContext";
import { AdminPanelProvider } from "./AdminPanelContext";
import { Sidebar } from "./Sidebar";
import { RightPanel } from "./RightPanel";
import { matchNav, NAV_LABELS } from "../lib/nav";

function MobileTopBar() {
  const { setOpen: setLeftOpen } = useMobileNav();
  const { setOpen: setRightOpen } = useRightPanel();
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-brand-border px-4 lg:hidden">
      <div className="flex items-center gap-3">
        <button onClick={() => setLeftOpen(true)} aria-label="Open navigation" className="text-brand-text">
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-display text-sm font-bold uppercase tracking-wide text-brand-text">
          Bancroft Brew Bowl
        </span>
      </div>
      <button onClick={() => setRightOpen(true)} aria-label="Open panel" className="text-brand-text">
        <Settings className="h-5 w-5" />
      </button>
    </div>
  );
}

function PageHeader() {
  const { pathname } = useLocation();
  const navKey = matchNav(pathname);
  if (!navKey) return null;

  return (
    <h1 className="px-6 pb-6 pt-6 font-display text-2xl font-bold uppercase tracking-wide text-brand-text">
      {NAV_LABELS[navKey]}
    </h1>
  );
}

export function Shell() {
  return (
    <MobileNavProvider>
      <RightPanelProvider>
        <AdminPanelProvider>
          <div className="flex min-h-screen bg-brand-bg">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <MobileTopBar />
              <main className="flex-1">
                <PageHeader />
                <Outlet />
              </main>
            </div>
            <RightPanel />
          </div>
        </AdminPanelProvider>
      </RightPanelProvider>
    </MobileNavProvider>
  );
}
