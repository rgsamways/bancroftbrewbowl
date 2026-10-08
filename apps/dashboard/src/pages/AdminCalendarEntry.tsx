import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  APP_LINKS,
  CALENDAR_TYPES,
  CALENDAR_TYPE_TEXT,
  MAX_LINK_LABEL,
  MAX_NOTE,
  MAX_TITLE,
  REPEATS,
  REPEAT_TEXT,
  easternToday,
  formatEventDayLong,
  weekdayOf,
  type AdminCalendarEntryDetail,
  type AppLinkTarget,
  type CalendarLink,
  type CalendarType,
  type Repeat,
} from "@bbb/shared";
import { api, ApiError } from "../lib/api";
import { useApi } from "../lib/useApi";
import { buttonClass, inputClass, secondaryButtonClass } from "./admin-pool/shared";

const label = "block text-sm font-semibold text-brand-text";
const dangerClass = "flex min-h-12 flex-none items-center justify-center whitespace-nowrap rounded-[12px] bg-brand-danger px-4 font-semibold text-brand-accent-ink disabled:opacity-50";
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDINAL = ["1st", "2nd", "3rd", "4th", "5th"];

type Pool = { id: string; name: string };
type LinkChoice = "none" | AppLinkTarget | "pool" | "url";
type Form = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  type: CalendarType;
  note: string;
  linkChoice: LinkChoice;
  poolId: string;
  url: string;
  linkLabel: string;
  repeat: Repeat;
  repeatUntil: string;
};

const EMPTY: Form = { title: "", date: "", startTime: "", endTime: "", type: "event", note: "", linkChoice: "none", poolId: "", url: "", linkLabel: "", repeat: "none", repeatUntil: "" };

function linkToForm(link: CalendarLink | null): Pick<Form, "linkChoice" | "poolId" | "url" | "linkLabel"> {
  if (!link) return { linkChoice: "none", poolId: "", url: "", linkLabel: "" };
  const linkLabel = link.label ?? "";
  if (link.kind === "url") return { linkChoice: "url", poolId: "", url: link.target, linkLabel };
  if (link.target.startsWith("pool:")) return { linkChoice: "pool", poolId: link.target.slice(5), url: "", linkLabel };
  return { linkChoice: link.target as AppLinkTarget, poolId: "", url: "", linkLabel };
}

function formToLink(f: Form): { kind: "app" | "url"; target: string; label: string | null } | null {
  const lbl = f.linkLabel.trim() || null;
  if (f.linkChoice === "none") return null;
  if (f.linkChoice === "url") return { kind: "url", target: f.url.trim(), label: lbl };
  if (f.linkChoice === "pool") return { kind: "app", target: `pool:${f.poolId}`, label: lbl };
  return { kind: "app", target: f.linkChoice, label: lbl };
}

function repeatHint(date: string, repeat: Repeat): string | null {
  if (!date || repeat === "none") return null;
  const day = WEEKDAYS[weekdayOf(date)]!;
  if (repeat === "weekly") return `Every ${day}.`;
  if (repeat === "biweekly") return `Every other ${day}.`;
  return `The ${ORDINAL[Math.ceil(Number(date.slice(8, 10)) / 7) - 1]} ${day} of each month.`;
}

/** Add or change a calendar entry. A repeating entry first asks whether you mean just one day or the
 * whole series. */
export function AdminCalendarEntry() {
  const { id } = useParams();
  const isNew = id === "new";
  const [params] = useSearchParams();
  const day = params.get("date") ?? "";
  const navigate = useNavigate();
  const { data: detail, error, reload } = useApi<AdminCalendarEntryDetail>(isNew ? "/calendar/entries/none" : `/calendar/entries/${id}`);
  const { data: pools } = useApi<Pool[]>("/pools");
  const [mode, setMode] = useState<"choose" | "day" | "all">(isNew ? "all" : "choose");
  const [form, setForm] = useState<Form>({ ...EMPTY, date: isNew && day ? day : easternToday(new Date()) });
  const [ready, setReady] = useState(isNew);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"cancel-day" | "remove" | null>(null);

  const repeating = detail ? detail.repeat !== "none" : false;
  const upcomingCancelled = detail ? detail.cancelledDays.filter((d) => d >= easternToday(new Date())) : [];
  const [restored, setRestored] = useState<string | null>(null);

  async function restore(date: string) {
    setBusy(true);
    setProblem(null);
    setRestored(null);
    try {
      await api(`/calendar/entries/${id}/days/${date}/restore`, { method: "POST" });
      setRestored(date);
      await reload();
    } catch (e) {
      setProblem(`${e instanceof ApiError ? e.message : "Something went wrong"} Nothing was changed.`);
    } finally {
      setBusy(false);
    }
  }

  // Fill the form once the entry loads: the series for "all", or what that one day shows for "day".
  useEffect(() => {
    if (!detail || isNew) return;
    const changed = detail.changedDays.find((d) => d.date === day);
    const base =
      mode === "day"
        ? {
            title: changed?.title ?? detail.title,
            startTime: (changed ? changed.startTime : detail.startTime) ?? "",
            endTime: (changed ? changed.endTime : detail.endTime) ?? "",
            type: changed?.type ?? detail.type,
            note: (changed ? changed.note : detail.note) ?? "",
            ...linkToForm(changed ? changed.link : detail.link),
          }
        : { title: detail.title, startTime: detail.startTime ?? "", endTime: detail.endTime ?? "", type: detail.type, note: detail.note ?? "", ...linkToForm(detail.link) };
    setForm({ ...EMPTY, ...base, date: detail.date, repeat: detail.repeat, repeatUntil: detail.repeatUntil ?? "" });
    setReady(true);
    if (mode === "choose" && detail.repeat === "none") setMode("all");
  }, [detail, isNew, mode, day]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function run(work: () => Promise<void>, failure: string) {
    setBusy(true);
    setProblem(null);
    try {
      await work();
      navigate(day ? `/admin/calendar?from=${day}` : "/admin/calendar");
    } catch (e) {
      setConfirming(null);
      setProblem(`${e instanceof ApiError ? e.message : "Something went wrong"} ${failure}`);
    } finally {
      setBusy(false);
    }
  }

  function details() {
    return { title: form.title, startTime: form.startTime || null, endTime: form.endTime || null, type: form.type, note: form.note || null, link: formToLink(form) };
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (mode === "day") {
      void run(() => api(`/calendar/entries/${id}/days/${day}`, { method: "PUT", body: JSON.stringify(details()) }), "Nothing was saved.");
      return;
    }
    const body = { ...details(), date: form.date, repeat: form.repeat, repeatUntil: form.repeat === "none" ? null : form.repeatUntil || null };
    void run(() => api(isNew ? "/calendar/entries" : `/calendar/entries/${id}`, { method: isNew ? "POST" : "PATCH", body: JSON.stringify(body) }).then(() => undefined), "Nothing was saved.");
  }

  const dayText = day ? formatEventDayLong(day) : "";
  const back = day ? `/admin/calendar?from=${day}` : "/admin/calendar";
  const title = isNew ? "Add to the calendar" : mode === "day" ? `Change ${dayText}` : "Calendar entry";

  return (
    <div className="mx-auto max-w-lg space-y-6 px-6 pb-6 pt-4">
      <div>
        <Link to={back} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-muted">
          Calendar
        </Link>
        <h1 className="text-3xl font-semibold leading-tight text-brand-text">{title}</h1>
      </div>

      {!isNew && error && !detail && <p className="text-sm text-brand-muted">That entry isn&apos;t there any more.</p>}

      {!isNew && detail && repeating && mode === "choose" && (
        <section className="space-y-3 rounded-[14px] border border-brand-border bg-brand-surface p-4">
          <p className="text-brand-text">&quot;{detail.title}&quot; repeats. What do you want to change?</p>
          {day && (
            <button type="button" onClick={() => setMode("day")} className={buttonClass}>
              Just {dayText}
            </button>
          )}
          <button type="button" onClick={() => setMode("all")} className={secondaryButtonClass}>
            All in the series
          </button>
        </section>
      )}

      {ready && mode !== "choose" && (
        <form onSubmit={save} className="space-y-4">
          {mode === "day" && <p className="text-sm text-brand-muted">This changes {dayText} only. The other days stay as they are.</p>}
          <label className={label}>
            Title
            <input value={form.title} maxLength={MAX_TITLE} onChange={(e) => set("title", e.target.value)} className={`${inputClass} mt-1`} placeholder="Taco Tuesday" />
          </label>
          <label className={label}>
            Type
            <select value={form.type} onChange={(e) => set("type", e.target.value as CalendarType)} className={`${inputClass} mt-1`}>
              {CALENDAR_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CALENDAR_TYPE_TEXT[t]}
                </option>
              ))}
            </select>
          </label>
          {mode === "all" && (
            <label className={label}>
              {form.repeat === "none" ? "Date" : "First day"}
              <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} className={`${inputClass} mt-1`} />
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>
              Starts (optional)
              <input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} className={`${inputClass} mt-1`} />
            </label>
            <label className={label}>
              Ends (optional)
              <input type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} className={`${inputClass} mt-1`} />
            </label>
          </div>
          <p className="-mt-2 text-xs text-brand-muted">Leave both empty for an all-day entry.</p>
          <label className={label}>
            Note (optional)
            <textarea value={form.note} rows={3} maxLength={MAX_NOTE} onChange={(e) => set("note", e.target.value)} className={`${inputClass} mt-1 py-2`} placeholder="Two for one until 8" />
          </label>

          <fieldset className="space-y-3 rounded-[14px] border border-brand-border p-3">
            <legend className="px-1 text-sm font-semibold text-brand-text">Link (optional)</legend>
            <label className={label}>
              Send people to
              <select value={form.linkChoice} onChange={(e) => set("linkChoice", e.target.value as LinkChoice)} className={`${inputClass} mt-1`}>
                <option value="none">No link</option>
                {(Object.keys(APP_LINKS) as AppLinkTarget[]).map((k) => (
                  <option key={k} value={k}>
                    {APP_LINKS[k].label}
                  </option>
                ))}
                <option value="pool">Join a pool</option>
                <option value="url">A web address</option>
              </select>
            </label>
            {form.linkChoice === "pool" && (
              <label className={label}>
                Pool
                <select value={form.poolId} onChange={(e) => set("poolId", e.target.value)} className={`${inputClass} mt-1`}>
                  <option value="">Choose a pool</option>
                  {(pools ?? []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {form.linkChoice === "url" && (
              <label className={label}>
                Web address
                <input value={form.url} inputMode="url" onChange={(e) => set("url", e.target.value)} className={`${inputClass} mt-1`} placeholder="https://" />
              </label>
            )}
            {form.linkChoice !== "none" && (
              <label className={label}>
                Button words (optional)
                <input value={form.linkLabel} maxLength={MAX_LINK_LABEL} onChange={(e) => set("linkLabel", e.target.value)} className={`${inputClass} mt-1`} placeholder="Get tickets" />
              </label>
            )}
          </fieldset>

          {mode === "all" && (
            <fieldset className="space-y-3 rounded-[14px] border border-brand-border p-3">
              <legend className="px-1 text-sm font-semibold text-brand-text">Repeats</legend>
              <label className={label}>
                How often
                <select value={form.repeat} onChange={(e) => set("repeat", e.target.value as Repeat)} className={`${inputClass} mt-1`}>
                  {REPEATS.map((r) => (
                    <option key={r} value={r}>
                      {REPEAT_TEXT[r]}
                    </option>
                  ))}
                </select>
              </label>
              {repeatHint(form.date, form.repeat) && <p className="text-sm text-brand-muted">{repeatHint(form.date, form.repeat)}</p>}
              {form.repeat !== "none" && (
                <label className={label}>
                  Until (optional)
                  <input type="date" value={form.repeatUntil} onChange={(e) => set("repeatUntil", e.target.value)} className={`${inputClass} mt-1`} />
                </label>
              )}
            </fieldset>
          )}

          {problem && (
            <p role="alert" className="text-sm text-brand-danger">
              {problem}
            </p>
          )}
          <button type="submit" disabled={busy || form.title.trim() === "" || form.date === ""} className={`${buttonClass} disabled:opacity-50`}>
            {isNew ? "Add to calendar" : "Save"}
          </button>
        </form>
      )}

      {!isNew && detail && mode === "all" && upcomingCancelled.length > 0 && (
        <section data-testid="cancelled-days" className="space-y-2 rounded-[14px] border border-brand-border bg-brand-surface p-4">
          <h2 className="font-semibold text-brand-text">Cancelled days</h2>
          <p className="text-sm text-brand-muted">These days are skipped. Restore one to bring it back as the series has it.</p>
          <ul>
            {upcomingCancelled.map((d) => (
              <li key={d} className="flex items-center justify-between gap-3 border-t border-brand-border py-1">
                <span className="text-brand-text">{formatEventDayLong(d)}</span>
                <button type="button" disabled={busy} onClick={() => void restore(d)} aria-label={`Restore ${formatEventDayLong(d)}`} className="min-h-11 rounded-[12px] border border-brand-border px-4 text-sm font-semibold text-brand-text hover:border-brand-accent disabled:opacity-50">
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {restored && (
        <p role="status" className="text-sm text-emerald-400">
          {formatEventDayLong(restored)} is back on the calendar.
        </p>
      )}

      {!isNew && detail && mode !== "choose" && (
        <section className="space-y-3 rounded-[14px] border border-brand-border bg-brand-surface p-4">
          {mode === "day" && (
            <div>
              <h2 className="font-semibold text-brand-text">Cancel {dayText} only</h2>
              <p className="mt-1 text-sm text-brand-muted">The other days stay.</p>
              {confirming === "cancel-day" ? (
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={busy} onClick={() => void run(() => api(`/calendar/entries/${id}/days/${day}`, { method: "DELETE" }), "Nothing was changed.")} className={dangerClass}>
                    Yes, cancel it
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} className={secondaryButtonClass}>
                    Keep it
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirming("cancel-day")} className={`${secondaryButtonClass} mt-3`}>
                  Cancel this day
                </button>
              )}
            </div>
          )}
          <div>
            <h2 className="font-semibold text-brand-text">{repeating ? "Remove the whole series" : "Remove this entry"}</h2>
            <p className="mt-1 text-sm text-brand-muted">{repeating ? "Every day of it goes, including days you changed." : "It comes off the calendar for good."}</p>
            {confirming === "remove" ? (
              <div className="mt-3 flex gap-2">
                <button type="button" disabled={busy} onClick={() => void run(() => api(`/calendar/entries/${id}`, { method: "DELETE" }), "Nothing was removed.")} className={dangerClass}>
                  Yes, remove it
                </button>
                <button type="button" onClick={() => setConfirming(null)} className={secondaryButtonClass}>
                  Keep it
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming("remove")} className={`${secondaryButtonClass} mt-3`}>
                {repeating ? "Remove the series" : "Remove entry"}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
