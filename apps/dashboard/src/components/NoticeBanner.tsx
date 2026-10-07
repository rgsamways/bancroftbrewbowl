import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { closedStillActive, visibleNotices, type Notice } from "@bbb/shared";
import { api } from "../lib/api";

const STORAGE_KEY = "bbb.closedNotices";

function readClosed(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeClosed(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage is unavailable: the notice simply shows again next visit.
  }
}

/** Important notices at the top of every player page. Each can be closed; it stays closed on this
 * device until it is removed, and a newly posted notice always shows. Plain text only. */
export function NoticeBanner() {
  const [active, setActive] = useState<Notice[]>([]);
  const [closed, setClosed] = useState<string[]>(readClosed);

  useEffect(() => {
    let live = true;
    api<{ notices: Notice[] }>("/me/notices")
      .then(({ notices }) => {
        if (!live) return;
        setActive(notices);
        // Forget closed notices that are gone, so storage never grows.
        const keep = closedStillActive(readClosed(), notices);
        writeClosed(keep);
        setClosed(keep);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const shown = visibleNotices(active, closed);
  if (shown.length === 0) return null;

  function close(id: string) {
    const next = [...closed, id];
    writeClosed(next);
    setClosed(next);
  }

  return (
    <div data-testid="notice-banner" className="mx-auto w-full max-w-lg space-y-3 px-6 pt-4">
      {shown.map((n) => (
        <section
          key={n.id}
          role="region"
          aria-label={`Notice: ${n.title}`}
          data-testid="notice"
          className="flex items-start gap-3 rounded-[14px] border border-brand-accent bg-brand-accent-soft py-3 pl-4 pr-1"
        >
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-brand-text">{n.title}</p>
            <p className="mt-0.5 whitespace-pre-line break-words text-sm text-brand-muted">{n.message}</p>
          </div>
          <button
            type="button"
            onClick={() => close(n.id)}
            aria-label={`Close notice: ${n.title}`}
            className="grid h-11 w-11 flex-none place-items-center rounded-full text-brand-muted"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </section>
      ))}
    </div>
  );
}
