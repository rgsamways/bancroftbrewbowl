import { useState } from "react";
import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { SLIDE_KIND_TEXT, type AdminTv as AdminTvData } from "@bbb/shared";
import { api, ApiError } from "../lib/api";
import { useAccess } from "../lib/useAccess";
import { useApi } from "../lib/useApi";
import { buttonClass, inputClass } from "./admin-pool/shared";

/** TV screens: the playlists (what a TV shows, in order) and which playlist each screen plays.
 * For the whole brewery, not one pool. */
export function AdminTv() {
  const { data, error, reload } = useApi<AdminTvData>("/tv");
  const { isOperator } = useAccess();
  const [problem, setProblem] = useState<string | null>(null);

  async function change(screenId: string, body: object) {
    setProblem(null);
    try {
      await api(`/tv/screens/${screenId}`, { method: "PATCH", body: JSON.stringify(body) });
      await reload();
    } catch (e) {
      setProblem(`${e instanceof ApiError ? e.message : "Something went wrong"}. Nothing was changed.`);
      await reload();
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-6 pb-6 pt-4">
      <div>
        <Link to="/admin/more" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-muted">
          More
        </Link>
        <h1 className="text-3xl font-semibold leading-tight text-brand-text">TV screens</h1>
        <p className="mt-1 text-sm text-brand-muted">Build playlists of slides, then choose what each TV plays. These are for the whole brewery, not one pool.</p>
      </div>

      {error && !data && <p className="text-sm text-brand-muted">We couldn't load this. Check your connection and try again.</p>}

      {data && (
        <>
          <section>
            <h2 className="mb-2 text-sm font-semibold text-brand-muted">Screens</h2>
            {data.screens.length === 0 ? (
              <p className="rounded-[14px] border border-brand-border bg-brand-surface p-4 text-sm text-brand-muted">
                {isOperator ? (
                  <>
                    No TVs are set up yet. <Link to="/admin/setup/tv" className="font-semibold text-brand-accent underline">Add one in Site setup.</Link>
                  </>
                ) : (
                  "No TVs are set up yet. The site owner adds them."
                )}
              </p>
            ) : (
              <ul className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
                {data.screens.map((s) => (
                  <li key={s.id} data-testid="tv-screen" className="space-y-3 border-b border-brand-border px-4 py-3 last:border-b-0">
                    <p className="text-brand-text">{s.name}</p>
                    <label className="block text-sm font-semibold text-brand-text">
                      Plays
                      <select
                        value={s.playlistId ?? ""}
                        onChange={(e) => void change(s.id, { playlistId: e.target.value || null })}
                        className={`${inputClass} mt-1`}
                      >
                        <option value="">Nothing</option>
                        {data.playlists.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex min-h-11 items-center gap-3 text-sm text-brand-text">
                      <input type="checkbox" checked={s.showQr} onChange={(e) => void change(s.id, { showQr: e.target.checked })} className="h-5 w-5 accent-[#c17a45]" />
                      Show "Play on your phone" along the bottom
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {problem && (
              <p role="alert" className="mt-2 text-sm text-brand-danger">
                {problem}
              </p>
            )}
            <p className="mt-2 text-xs text-brand-muted">A change shows on the TV within about 30 seconds.</p>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-brand-muted">Playlists</h2>
            {data.playlists.length > 0 && (
              <ul className="mb-3 overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
                {data.playlists.map((p) => (
                  <li key={p.id} data-testid="tv-playlist" className="border-b border-brand-border last:border-b-0">
                    <Link to={`/admin/tv/playlists/${p.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-brand-surface-raised">
                      <span className="min-w-0 flex-1">
                        <span className="block text-brand-text">{p.name}</span>
                        <span className="block truncate text-sm text-brand-muted">
                          {p.slides.length === 0 ? "No slides yet" : p.slides.map((s) => SLIDE_KIND_TEXT[s.kind]).join(", ")}
                          {p.screens.length > 0 && ` · on ${p.screens.join(", ")}`}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 flex-none text-brand-faint" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/admin/tv/playlists/new" className={buttonClass}>
              New playlist
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
