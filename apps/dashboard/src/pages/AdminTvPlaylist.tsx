import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import {
  DEFAULT_SECONDS,
  MAX_SECONDS,
  MAX_SLIDES,
  MIN_SECONDS,
  SLIDE_KINDS,
  SLIDE_KIND_TEXT,
  type AdminTv,
  type SlideInput,
  type SlideKind,
} from "@bbb/shared";
import { api, ApiError } from "../lib/api";
import { useApi } from "../lib/useApi";
import { buttonClass, inputClass, secondaryButtonClass } from "./admin-pool/shared";

type Row = { key: number; kind: SlideKind; poolId: string | null; seconds: number; enabled: boolean };

let nextKey = 1;

/** One playlist: its name and its slides in order. Saving replaces the whole list. */
export function AdminTvPlaylist() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const { data, error } = useApi<AdminTv>("/tv");
  const [name, setName] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(isNew);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const playlist = data?.playlists.find((p) => p.id === id);
  useEffect(() => {
    if (!playlist || loaded) return;
    setName(playlist.name);
    setRows(playlist.slides.map((s) => ({ key: nextKey++, kind: s.kind, poolId: s.poolId, seconds: s.seconds, enabled: s.enabled })));
    setLoaded(true);
  }, [playlist, loaded]);

  function update(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function move(index: number, by: -1 | 1) {
    setRows((rs) => {
      const next = [...rs];
      const [row] = next.splice(index, 1);
      next.splice(index + by, 0, row!);
      return next;
    });
  }
  function add(kind: SlideKind) {
    setRows((rs) => [...rs, { key: nextKey++, kind, poolId: kind === "standings" ? (data?.pools[0]?.id ?? null) : null, seconds: DEFAULT_SECONDS, enabled: true }]);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    const slides: SlideInput[] = rows.map((r) => ({ kind: r.kind, poolId: r.poolId, seconds: r.seconds, enabled: r.enabled }));
    try {
      await api(isNew ? "/tv/playlists" : `/tv/playlists/${id}`, { method: isNew ? "POST" : "PUT", body: JSON.stringify({ name, slides }) });
      navigate("/admin/tv");
    } catch (e) {
      setProblem(`${e instanceof ApiError ? e.message : "Something went wrong"}. Nothing was saved.`);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setProblem(null);
    try {
      await api(`/tv/playlists/${id}`, { method: "DELETE" });
      navigate("/admin/tv");
    } catch (e) {
      setConfirming(false);
      setProblem(`${e instanceof ApiError ? e.message : "Something went wrong"}`);
    } finally {
      setBusy(false);
    }
  }

  const missing = !isNew && data && !playlist;

  return (
    <div className="mx-auto max-w-lg space-y-6 px-6 pb-6 pt-4">
      <div>
        <Link to="/admin/tv" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-muted">
          TV screens
        </Link>
        <h1 className="text-3xl font-semibold leading-tight text-brand-text">{isNew ? "New playlist" : "Playlist"}</h1>
      </div>

      {error && !data && <p className="text-sm text-brand-muted">We couldn't load this. Check your connection and try again.</p>}
      {missing && <p className="text-sm text-brand-muted">That playlist isn't there any more.</p>}

      {data && loaded && (
        <form onSubmit={save} className="space-y-5">
          <label className="block text-sm font-semibold text-brand-text">
            Name
            <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={`${inputClass} mt-1`} placeholder="Game day" />
          </label>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-brand-muted">Slides, in the order they show</h2>
            {rows.length === 0 && <p className="rounded-[14px] border border-brand-border bg-brand-surface p-4 text-sm text-brand-muted">No slides yet. Add one below.</p>}
            <ul className="space-y-3">
              {rows.map((r, i) => (
                <li key={r.key} data-testid="tv-slide-row" className="rounded-[14px] border border-brand-border bg-brand-surface p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-brand-text">{SLIDE_KIND_TEXT[r.kind]}</p>
                    <div className="flex">
                      <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${SLIDE_KIND_TEXT[r.kind]} up`} className="grid h-11 w-11 place-items-center text-brand-muted disabled:opacity-30">
                        <ArrowUp className="h-5 w-5" aria-hidden="true" />
                      </button>
                      <button type="button" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${SLIDE_KIND_TEXT[r.kind]} down`} className="grid h-11 w-11 place-items-center text-brand-muted disabled:opacity-30">
                        <ArrowDown className="h-5 w-5" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={`Remove ${SLIDE_KIND_TEXT[r.kind]}`} className="grid h-11 w-11 place-items-center text-brand-muted">
                        <X className="h-5 w-5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  {r.kind === "standings" && (
                    <label className="mt-1 block text-sm font-semibold text-brand-text">
                      Pool
                      <select value={r.poolId ?? ""} onChange={(e) => update(r.key, { poolId: e.target.value || null })} className={`${inputClass} mt-1`}>
                        {data.pools.length === 0 && <option value="">No pools yet</option>}
                        {data.pools.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="mt-2 flex items-end gap-4">
                    <label className="block text-sm font-semibold text-brand-text">
                      Seconds
                      <input
                        type="number"
                        inputMode="numeric"
                        min={MIN_SECONDS}
                        max={MAX_SECONDS}
                        value={r.seconds}
                        onChange={(e) => update(r.key, { seconds: Number(e.target.value) })}
                        className={`${inputClass} mt-1 w-24`}
                      />
                    </label>
                    <label className="flex min-h-12 items-center gap-2 text-sm text-brand-text">
                      <input type="checkbox" checked={r.enabled} onChange={(e) => update(r.key, { enabled: e.target.checked })} className="h-5 w-5 accent-[#c17a45]" />
                      Show it
                    </label>
                  </div>
                </li>
              ))}
            </ul>

            {rows.length < MAX_SLIDES ? (
              <div className="mt-3">
                <p className="mb-2 text-sm font-semibold text-brand-muted">Add a slide</p>
                <div className="flex flex-wrap gap-2">
                  {SLIDE_KINDS.map((k) => (
                    <button key={k} type="button" onClick={() => add(k)} className="min-h-11 rounded-[12px] border border-brand-border px-4 font-semibold text-brand-text hover:border-brand-accent">
                      {SLIDE_KIND_TEXT[k]}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-brand-muted">That's the most a playlist can hold ({MAX_SLIDES}).</p>
            )}
          </section>

          {problem && (
            <p role="alert" className="text-sm text-brand-danger">
              {problem}
            </p>
          )}
          <button type="submit" disabled={busy || name.trim() === ""} className={`${buttonClass} disabled:opacity-50`}>
            Save playlist
          </button>
        </form>
      )}

      {data && loaded && !isNew && (
        <section className="rounded-[14px] border border-brand-border bg-brand-surface p-4">
          <h2 className="font-semibold text-brand-text">Delete this playlist</h2>
          <p className="mt-1 text-sm text-brand-muted">A playlist that a screen is playing can't be deleted.</p>
          {confirming ? (
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={busy} onClick={() => void remove()} className="flex min-h-12 flex-none items-center justify-center whitespace-nowrap rounded-[12px] bg-brand-danger px-4 font-semibold text-brand-accent-ink">
                Yes, delete it
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={secondaryButtonClass}>
                Keep it
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className={`${secondaryButtonClass} mt-3`}>
              Delete playlist
            </button>
          )}
        </section>
      )}
    </div>
  );
}
