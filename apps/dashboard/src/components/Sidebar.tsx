import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Home as HomeIcon, Calendar, Trophy, Megaphone, User, LogOut, X } from "lucide-react";
import { authClient, useSession, type AppUser } from "../lib/auth-client";
import { api } from "../lib/api";
import { useMobileNav } from "./MobileNavContext";
import { matchNav } from "../lib/nav";

type MyEntry = {
  id: string;
  poolId: string;
  status: "alive" | "eliminated";
  pool: { id: string; name: string };
};

export function Sidebar() {
  const { pathname } = useLocation();
  const navKey = matchNav(pathname);
  const { open, setOpen } = useMobileNav();
  const { data: session } = useSession();
  const [myEntries, setMyEntries] = useState<MyEntry[]>([]);

  const isAdmin = (session?.user as AppUser | undefined)?.isAdmin;

  useEffect(() => {
    api<MyEntry[]>("/me/entries")
      .then(setMyEntries)
      .catch(() => setMyEntries([]));
  }, []);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-brand-border bg-brand-surface transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        } lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-brand-border px-4">
          <Link
            to="/"
            onClick={() => setOpen(false)}
            className="font-display text-sm font-bold uppercase tracking-wide text-brand-text"
          >
            Bancroft Brew Bowl
          </Link>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="text-brand-muted hover:text-brand-text lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <Link
            to="/"
            onClick={() => setOpen(false)}
            className={`flex items-center gap-2 rounded px-3 py-2 text-sm font-medium ${
              navKey === "home"
                ? "bg-brand-surface-raised text-brand-accent"
                : "text-brand-text hover:bg-brand-surface-raised"
            }`}
          >
            <HomeIcon className="h-4 w-4" />
            Home
          </Link>

          {myEntries.length > 0 && (
            <div className="mt-6">
              <p className="mb-1 px-3 font-display text-xs font-semibold uppercase tracking-wide text-brand-muted">
                Your Pools
              </p>
              {myEntries.map((entry) => {
                const to =
                  entry.status === "alive"
                    ? `/pool/${entry.poolId}/entry/${entry.id}/pick`
                    : `/pool/${entry.poolId}`;
                const active = pathname.startsWith(`/pool/${entry.poolId}`);
                return (
                  <Link
                    key={entry.id}
                    to={to}
                    onClick={() => setOpen(false)}
                    className={`block truncate rounded px-3 py-2 text-sm ${
                      active
                        ? "bg-brand-surface-raised text-brand-accent"
                        : "text-brand-text hover:bg-brand-surface-raised"
                    }`}
                  >
                    {entry.pool.name}
                  </Link>
                );
              })}
            </div>
          )}

          {isAdmin && (
            <div className="mt-6">
              <p className="mb-1 px-3 font-display text-xs font-semibold uppercase tracking-wide text-brand-muted">
                Admin
              </p>
              {[
                { to: "/admin/schedule", label: "Schedule", Icon: Calendar, key: "schedule" as const },
                { to: "/admin", label: "Pools", Icon: Trophy, key: "pools" as const },
                { to: "/admin/promotions", label: "Promotions", Icon: Megaphone, key: "promotions" as const },
              ].map(({ to, label, Icon, key }) => {
                const active = navKey === key;
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 rounded px-3 py-2 text-sm font-medium ${
                      active
                        ? "bg-brand-surface-raised text-brand-accent"
                        : "text-brand-text hover:bg-brand-surface-raised"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        <div className="shrink-0 border-t border-brand-border p-4">
          <Link
            to="/account"
            onClick={() => setOpen(false)}
            className={`mb-2 flex items-center gap-2 rounded px-1 py-1 text-sm ${
              navKey === "account" ? "text-brand-accent" : "text-brand-text hover:text-brand-accent"
            }`}
          >
            <User className="h-4 w-4" />
            <span className="truncate">{session?.user.name ?? session?.user.email}</span>
          </Link>
          <button
            onClick={() => authClient.signOut()}
            className="flex items-center gap-2 px-1 text-sm text-brand-muted hover:text-brand-accent"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
