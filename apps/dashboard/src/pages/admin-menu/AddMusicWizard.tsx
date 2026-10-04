import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { easternToday, formatEventDayLong, formatEventTime, nextWeekendDates, type CreateMusicEventInput } from "@bbb/shared";
import { api, ApiError } from "../../lib/api";
import { FocusBar } from "../../components/AdminLayout";
import { buttonClass, inputClass, secondaryButtonClass } from "../admin-pool/shared";

// Adding a band or an event one question at a time. It shows in the Music tab straight away.

const TOTAL = 3;
const heading = "mt-2 text-3xl font-semibold leading-tight text-brand-text";

type Draft = { title: string; date: string; startTime: string; endTime: string };
const emptyDraft: Draft = { title: "", date: "", startTime: "", endTime: "" };

/** The body to send, or the first problem to tell the person about. */
export function musicPayload(d: Draft): { ok: true; body: CreateMusicEventInput } | { ok: false; error: string } {
  if (!d.title.trim()) return { ok: false, error: "Say who's playing." };
  if (!d.date) return { ok: false, error: "Pick a day." };
  if (d.endTime && !d.startTime) return { ok: false, error: "Add a start time, or clear the end time." };
  if (d.startTime && d.endTime && d.endTime <= d.startTime) return { ok: false, error: "The end has to be after the start." };
  return { ok: true, body: { title: d.title.trim(), date: d.date, startTime: d.startTime || null, endTime: d.endTime || null } };
}

export function WhenFields({ draft, set }: { draft: Draft; set: (patch: Partial<Draft>) => void }) {
  const today = easternToday(new Date());
  const quick = nextWeekendDates(today);
  const custom = draft.date !== "" && !quick.includes(draft.date);
  const [other, setOther] = useState(custom);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {quick.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={draft.date === d && !other}
            onClick={() => {
              setOther(false);
              set({ date: d });
            }}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
              draft.date === d && !other ? "border-brand-accent bg-brand-accent-soft text-brand-text" : "border-brand-border text-brand-muted"
            }`}
          >
            {formatEventDayLong(d)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={other}
          onClick={() => setOther(true)}
          className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${other ? "border-brand-accent bg-brand-accent-soft text-brand-text" : "border-brand-border text-brand-muted"}`}
        >
          Another date
        </button>
      </div>
      {other && (
        <label className="block text-sm font-semibold text-brand-text">
          Date
          <input type="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} className={`${inputClass} mt-1`} />
        </label>
      )}
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
      <p className="text-sm text-brand-muted">Times are optional. Without a start time players see "Time to be confirmed".</p>
    </div>
  );
}

export function AddMusicWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  if (added) {
    return (
      <>
        <FocusBar />
        <h1 className={`${heading} mt-6`}>Added</h1>
        <p className="mt-2 text-sm text-brand-muted">{added} is on the schedule.</p>
        <Link to="/admin/menu?tab=music" className={`${buttonClass} mt-6`}>
          Back to the music
        </Link>
        <button
          type="button"
          onClick={() => {
            setDraft(emptyDraft);
            setAdded(null);
            setStep(1);
          }}
          className={`${secondaryButtonClass} mt-2`}
        >
          Add another
        </button>
      </>
    );
  }

  function next() {
    setError(null);
    if (step === 1 && !draft.title.trim()) return setError("Say who's playing.");
    if (step === 2) {
      const r = musicPayload(draft);
      if (!r.ok) return setError(r.error);
    }
    setStep(step + 1);
  }

  async function submit() {
    const r = musicPayload(draft);
    if (!r.ok) return setError(r.error);
    setBusy(true);
    setError(null);
    try {
      await api("/music/events", { method: "POST", body: JSON.stringify(r.body) });
      setAdded(r.body.title);
    } catch (e) {
      setError(`${e instanceof ApiError ? e.message : "Something went wrong"}. Nothing was added.`);
    }
    setBusy(false);
  }

  return (
    <>
      <FocusBar label={`Step ${step} of ${TOTAL}`} onBack={() => (step === 1 ? navigate("/admin/menu?tab=music") : setStep(step - 1))} />
      {step === 1 && (
        <>
          <h1 className={heading}>Who's playing?</h1>
          <p className="mt-2 mb-4 text-sm text-brand-muted">A band, a musician, or the name of the event.</p>
          <label className="block text-sm font-semibold text-brand-text">
            Name
            <input
              value={draft.title}
              maxLength={80}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="e.g. Bradley McAree"
              className={`${inputClass} mt-1`}
            />
          </label>
        </>
      )}
      {step === 2 && (
        <>
          <h1 className={heading}>When?</h1>
          <p className="mt-2 mb-4 text-sm text-brand-muted">Pick the day, then the times.</p>
          <WhenFields draft={draft} set={set} />
        </>
      )}
      {step === 3 && (
        <>
          <h1 className={heading}>Ready to add it?</h1>
          <p className="mt-2 text-sm text-brand-muted">Players will see it in the Music tab.</p>
          <dl className="mt-4 divide-y divide-brand-border overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface text-sm">
            <div className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-brand-muted">Who</dt>
              <dd className="text-right text-brand-text">{draft.title.trim()}</dd>
            </div>
            <div className="flex justify-between gap-4 px-4 py-3">
              <dt className="text-brand-muted">When</dt>
              <dd className="text-right text-brand-text">
                {formatEventDayLong(draft.date)}, {formatEventTime(draft.startTime || null, draft.endTime || null)}
              </dd>
            </div>
          </dl>
        </>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-brand-danger">
          {error}
        </p>
      )}
      <div className="mt-6">
        {step < TOTAL ? (
          <button type="button" onClick={next} className={buttonClass}>
            Next
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => void submit()} className={buttonClass}>
            Add to the schedule
          </button>
        )}
      </div>
    </>
  );
}
