import { useState } from "react";
import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import type { BreweryItem } from "@bbb/shared";
import { api, ApiError } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { secondaryButtonClass } from "../admin-pool/shared";

// Tell players what's happening: the four things an admin can post, and what is showing now.

const ROWS = [
  { to: "/admin/brewery/feature", title: "Feature a drink or dish", detail: "Spotlight something from the menu" },
  { to: "/admin/brewery/special", title: "Add a special", detail: "A kitchen special on a day and time" },
  { to: "/admin/music/new", title: "Add live music", detail: "A band or an event" },
  { to: "/admin/brewery/announcement", title: "Write an announcement", detail: "Anything else you want to say" },
];

const KIND_TEXT = { feature: "Featured", special: "Special", announcement: "Announcement" } as const;

export function AdminBrewery() {
  const { data: items, error, reload } = useApi<BreweryItem[]>("/brewery/items");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function remove(id: string) {
    setMessage(null);
    try {
      await api(`/brewery/items/${id}`, { method: "DELETE" });
      setConfirming(null);
      await reload();
    } catch (e) {
      setMessage(`${e instanceof ApiError ? e.message : "Something went wrong"}. Nothing was removed.`);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-6 pb-6 pt-4">
      <div>
        <Link to="/admin/more" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-muted">
          More
        </Link>
        <h1 className="text-3xl font-semibold leading-tight text-brand-text">From the brewery</h1>
        <p className="mt-1 text-sm text-brand-muted">Tell players what's happening. What do you want to share?</p>
      </div>

      <ul className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
        {ROWS.map((r) => (
          <li key={r.to} className="border-b border-brand-border last:border-b-0">
            <Link to={r.to} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-brand-surface-raised">
              <span className="min-w-0 flex-1">
                <span className="block text-brand-text">{r.title}</span>
                <span className="block text-sm text-brand-muted">{r.detail}</span>
              </span>
              <ChevronRight className="h-4 w-4 flex-none text-brand-faint" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-brand-muted">Showing now</h2>
        {error && !items && <p className="text-sm text-brand-muted">We couldn't load this. Check your connection and try again.</p>}
        {items && items.length === 0 && (
          <p className="rounded-[14px] border border-brand-border bg-brand-surface p-4 text-sm text-brand-muted">
            Nothing posted. Players see the standard "Watch with us" message.
          </p>
        )}
        {items && items.length > 0 && (
          <ul className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
            {items.map((item) => (
              <li key={item.id} className="border-b border-brand-border px-4 py-3 last:border-b-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-accent">{KIND_TEXT[item.kind]}</p>
                <p className="text-brand-text">{item.title}</p>
                <p className="text-sm text-brand-muted">{item.detail}</p>
                {confirming === item.id ? (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void remove(item.id)}
                      className="flex min-h-11 flex-1 items-center justify-center rounded-[12px] bg-brand-danger px-4 font-semibold text-brand-accent-ink"
                    >
                      Yes, remove it
                    </button>
                    <button type="button" onClick={() => setConfirming(null)} className={secondaryButtonClass}>
                      Keep it
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(item.id)}
                    aria-label={`Remove ${item.title}`}
                    className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-brand-muted underline"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {message && (
          <p role="alert" className="mt-2 text-sm text-brand-danger">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
