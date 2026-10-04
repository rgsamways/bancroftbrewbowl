import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ChevronRight, Plus } from "lucide-react";
import { formatMenuPrice, styleLine, type MenuItem, type PublicMenu } from "@bbb/shared";
import { api, ApiError } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { buttonClass } from "../admin-pool/shared";
import { AdminMusicList } from "./AdminMusic";

// What players see in the Menu tab, with a switch on each item to mark it in or out.

function Switch({ on, label, busy, onChange }: { on: boolean; label: string; busy: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={() => onChange(!on)}
      className="grid min-h-11 min-w-11 flex-none place-items-center disabled:opacity-50"
    >
      <span className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${on ? "bg-brand-accent" : "bg-brand-surface-raised border border-brand-border"}`}>
        <span className={`h-5 w-5 rounded-full bg-white transition-transform ${on ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

export function AdminMenu() {
  const { data: menu, error, reload } = useApi<PublicMenu>("/menu/items");
  const [params, setParams] = useSearchParams();
  const music = params.get("tab") === "music";
  const kitchen = params.get("tab") === "kitchen";
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function setAvailable(item: MenuItem, available: boolean) {
    setBusy(item.id);
    setMessage(null);
    try {
      await api(`/menu/items/${item.id}/availability`, { method: "PATCH", body: JSON.stringify({ available }) });
      await reload();
    } catch (e) {
      setMessage(`${e instanceof ApiError ? e.message : "Something went wrong"}. Nothing was changed.`);
    }
    setBusy(null);
  }

  if (error && !menu) return <p className="px-6 pt-6 text-sm text-brand-muted">We couldn't load the menu. Check your connection and try again.</p>;
  if (!menu) return null;

  const sections = music ? [] : kitchen ? menu.kitchen : menu.drinks;
  const tab = (active: boolean) =>
    `flex min-h-11 flex-1 items-center justify-center rounded-[10px] text-sm font-semibold ${active ? "bg-brand-accent-soft text-brand-text" : "text-brand-muted"}`;

  return (
    <div className="mx-auto max-w-lg space-y-5 px-6 pb-6 pt-4">
      <div>
        <h1 className="text-3xl font-semibold leading-tight text-brand-text">Menu</h1>
        <p className="mt-1 text-sm text-brand-muted">What players see in the Menu tab.</p>
      </div>
      <nav aria-label="Menu sections" className="flex gap-1 rounded-[12px] border border-brand-border bg-brand-surface p-1">
        <button type="button" onClick={() => setParams({})} className={tab(!kitchen)}>
          Drinks
        </button>
        <button type="button" onClick={() => setParams({ tab: "kitchen" })} className={tab(kitchen)}>
          Kitchen
        </button>
        <button type="button" onClick={() => setParams({ tab: "music" })} className={tab(music)}>
          Music
        </button>
      </nav>
      {music ? (
        <AdminMusicList />
      ) : (
        <Link to={`/admin/menu/new?kind=${kitchen ? "dish" : "beer"}`} className={buttonClass}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          {kitchen ? "Add a dish" : "Add a drink"}
        </Link>
      )}
      {message && (
        <p role="alert" className="text-sm text-brand-danger">
          {message}
        </p>
      )}

      {sections.map((section) => (
        <section key={section.name}>
          <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-brand-muted">
            {section.name}
            <span className="text-brand-faint">{section.items.length}</span>
          </h2>
          {section.items.length === 0 ? (
            <p className="rounded-[14px] border border-brand-border bg-brand-surface p-4 text-sm text-brand-muted">Nothing here yet.</p>
          ) : (
            <ul className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
              {section.items.map((item) => (
                <li key={item.id} className="flex items-center border-b border-brand-border last:border-b-0">
                  <Link to={`/admin/menu/${item.id}`} className="flex min-h-14 min-w-0 flex-1 items-center gap-2 px-4 py-2 hover:bg-brand-surface-raised">
                    <span className="min-w-0 flex-1">
                      <span className={`block text-brand-text ${item.available ? "" : "line-through opacity-70"}`}>{item.name}</span>
                      <span className="block truncate text-sm text-brand-muted">
                        {[styleLine(item), item.description, formatMenuPrice(item.priceCents)].filter(Boolean).join(" · ") || "No details yet"}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 flex-none text-brand-faint" aria-hidden="true" />
                  </Link>
                  {item.kind !== "dish" && (
                    <>
                      <span className="text-xs text-brand-muted">{item.available ? "On tap" : "Out"}</span>
                      <Switch on={item.available} label={`${item.name} on tap`} busy={busy === item.id} onChange={(next) => void setAvailable(item, next)} />
                    </>
                  )}
                  {item.kind === "dish" && (
                    <>
                      <span className="text-xs text-brand-muted">{item.available ? "Available" : "Out"}</span>
                      <Switch on={item.available} label={`${item.name} available`} busy={busy === item.id} onChange={(next) => void setAvailable(item, next)} />
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      {kitchen && !music && sections.length === 0 && (
        <p className="rounded-[14px] border border-brand-border bg-brand-surface p-4 text-sm text-brand-muted">No dishes yet. Add the first one above.</p>
      )}
    </div>
  );
}
