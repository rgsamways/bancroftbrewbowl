import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { AdminMusic, MusicEvent } from "@bbb/shared";
import { api, ApiError } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { buttonClass, inputClass, secondaryButtonClass } from "../admin-pool/shared";
import { musicPayload } from "./AddMusicWizard";

// One event: change the name, day or times, or take it off the schedule for good.

const BACK = "/admin/menu?tab=music";

export function EditMusic() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, error: loadError } = useApi<AdminMusic>("/music/events");
  const [draft, setDraft] = useState<{ title: string; date: string; startTime: string; endTime: string } | null>(null);
  const [event, setEvent] = useState<MusicEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!data || event) return;
    const found = [...data.comingUp, ...data.past].find((e) => e.id === id);
    if (found) {
      setEvent(found);
      setDraft({ title: found.title, date: found.date, startTime: found.startTime ?? "", endTime: found.endTime ?? "" });
    }
  }, [data, id, event]);

  if (loadError && !data) return <p className="px-6 pt-6 text-sm text-brand-muted">We couldn't load this event. Check your connection and try again.</p>;
  if (!data) return null;
  if (!event || !draft) {
    return (
      <div className="mx-auto max-w-lg px-6 pt-6">
        <h1 className="text-3xl font-semibold text-brand-text">Not on the schedule</h1>
        <p className="mt-2 text-sm text-brand-muted">This event has been removed, or it never existed.</p>
        <Link to={BACK} className={`${buttonClass} mt-6`}>
          Back to the music
        </Link>
      </div>
    );
  }

  const set = (patch: Partial<typeof draft>) => {
    setSaved(false);
    setDraft({ ...draft, ...patch });
  };

  async function save() {
    const r = musicPayload(draft!);
    if (!r.ok) return setMessage(r.error);
    setBusy(true);
    setMessage(null);
    try {
      setEvent(await api<MusicEvent>(`/music/events/${id}`, { method: "PATCH", body: JSON.stringify(r.body) }));
      setSaved(true);
    } catch (e) {
      setMessage(`${e instanceof ApiError ? e.message : "Something went wrong"}. Nothing was changed.`);
    }
    setBusy(false);
  }

  async function remove() {
    setBusy(true);
    setMessage(null);
    try {
      await api(`/music/events/${id}`, { method: "DELETE" });
      navigate(BACK, { replace: true });
    } catch (e) {
      setMessage(`${e instanceof ApiError ? e.message : "Something went wrong"}. Nothing was removed.`);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-6 pb-6 pt-4">
      <Link to={BACK} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-muted">
        Back
      </Link>
      <h1 className="text-3xl font-semibold leading-tight text-brand-text">{event.title}</h1>
      <p className="mt-1 text-sm text-brand-muted">Edit the details below.</p>
      <div className="mt-4 space-y-4">
        <label className="block text-sm font-semibold text-brand-text">
          Name
          <input value={draft.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-sm font-semibold text-brand-text">
          Date
          <input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} className={`${inputClass} mt-1`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold text-brand-text">
            Starts
            <input type="time" value={draft.startTime} onChange={(e) => set({ startTime: e.target.value })} className={`${inputClass} mt-1`} />
          </label>
          <label className="block text-sm font-semibold text-brand-text">
            Ends
            <input type="time" value={draft.endTime} onChange={(e) => set({ endTime: e.target.value })} className={`${inputClass} mt-1`} />
          </label>
        </div>
      </div>
      {message && (
        <p role="alert" className="mt-3 text-sm text-brand-danger">
          {message}
        </p>
      )}
      {saved && (
        <p role="status" className="mt-3 text-sm text-emerald-400">
          Saved. Players can see the change now.
        </p>
      )}
      <button type="button" disabled={busy} onClick={() => void save()} className={`${buttonClass} mt-5`}>
        Save
      </button>

      <section className="mt-8 rounded-[14px] border border-brand-border bg-brand-surface p-4">
        <h2 className="font-semibold text-brand-text">Remove from the schedule</h2>
        <p className="mt-1 text-sm text-brand-muted">This takes it off the schedule for good.</p>
        {confirming ? (
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy} onClick={() => void remove()} className={`${buttonClass} !w-auto shrink-0 whitespace-nowrap !bg-brand-danger`}>
              Yes, remove it
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={secondaryButtonClass}>
              Keep it
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={`${secondaryButtonClass} mt-3`}>
            Remove {event.title}
          </button>
        )}
      </section>
    </div>
  );
}
