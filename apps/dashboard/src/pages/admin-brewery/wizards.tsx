import { useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  SPECIAL_TAGS,
  SPECIAL_TAG_TEXT,
  easternToday,
  formatMenuPrice,
  scheduleText,
  styleLine,
  type AdminSummary,
  type MenuItem,
  type PublicMenu,
  type SpecialTag,
} from "@bbb/shared";
import { api, ApiError } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { FocusBar } from "../../components/AdminLayout";
import { buttonClass, inputClass } from "../admin-pool/shared";

// The three posting wizards: feature a menu item, add a special, write an announcement.
// Each asks one thing at a time, shows what players will see, and ends on a plain done screen.

const heading = "mt-2 text-3xl font-semibold leading-tight text-brand-text";
const BACK = "/admin/brewery";
const label = "block text-sm font-semibold text-brand-text";

function choice(on: boolean) {
  return `flex min-h-14 w-full flex-col justify-center rounded-[14px] border px-4 text-left ${
    on ? "border-brand-accent bg-brand-accent-soft" : "border-brand-border bg-brand-surface"
  }`;
}

function Done({ title, text }: { title: string; text: string }) {
  return (
    <>
      <FocusBar />
      <h1 className={`${heading} mt-6`}>{title}</h1>
      <p className="mt-2 text-sm text-brand-muted">{text}</p>
      <Link to={BACK} className={`${buttonClass} mt-6`}>
        Back to From the brewery
      </Link>
    </>
  );
}

function Steps({
  step,
  total,
  onBack,
  error,
  children,
  action,
}: {
  step: number;
  total: number;
  onBack: () => void;
  error: string | null;
  children: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <>
      <FocusBar label={`Step ${step} of ${total}`} onBack={onBack} />
      {children}
      {error && (
        <p role="alert" className="mt-3 text-sm text-brand-danger">
          {error}
        </p>
      )}
      <div className="mt-6">{action}</div>
    </>
  );
}

function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(path: string, body: object, onDone: () => void) {
    setBusy(true);
    setError(null);
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      onDone();
    } catch (e) {
      setError(`${e instanceof ApiError ? e.message : "Something went wrong"}. Nothing was posted.`);
    }
    setBusy(false);
  }
  return { busy, error, setError, submit };
}

// ---- Feature ----

export function FeatureWizard() {
  const navigate = useNavigate();
  const { data: menu } = useApi<PublicMenu>("/menu/items");
  const { data: summary } = useApi<AdminSummary>("/admin/summary");
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [item, setItem] = useState<MenuItem | null>(null);
  const [scope, setScope] = useState<"week" | "open">("week");
  const [done, setDone] = useState(false);
  const { busy, error, setError, submit } = useSubmit();

  if (done) return <Done title="Featured" text={`Players will see ${item?.name} on their Home screen${scope === "week" ? " this week" : ""}.`} />;

  const all = menu ? [...menu.drinks, ...menu.kitchen].flatMap((s) => s.items) : [];
  const shown = all.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()));
  const week = summary?.weekNumber ?? null;

  return (
    <Steps
      step={step}
      total={2}
      onBack={() => (step === 1 ? navigate(BACK) : setStep(1))}
      error={error}
      action={
        step === 1 ? (
          <button
            type="button"
            className={buttonClass}
            onClick={() => (item ? (setError(null), setStep(2)) : setError("Pick something from the menu."))}
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || (scope === "week" && week === null)}
            className={buttonClass}
            onClick={() => void submit("/brewery/features", { menuItemId: item!.id, scope }, () => setDone(true))}
          >
            Feature it
          </button>
        )
      }
    >
      {step === 1 && (
        <>
          <h1 className={heading}>What do you want to feature?</h1>
          <p className="mt-2 mb-4 text-sm text-brand-muted">Pick something from your menu.</p>
          <label className={label}>
            Search the menu
            <input value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <div className="mt-3 space-y-2">
            {menu && all.length === 0 && <p className="text-sm text-brand-muted">The menu is empty. Add something to it first.</p>}
            {shown.map((i) => (
              <button key={i.id} type="button" aria-pressed={item?.id === i.id} onClick={() => setItem(i)} className={choice(item?.id === i.id)}>
                <span className="font-semibold text-brand-text">{i.name}</span>
                <span className="text-sm text-brand-muted">{i.kind === "dish" ? "Dish" : i.kind === "wine" ? "Wine" : i.kind === "drink" ? "Drink" : "Beer"}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <h1 className={heading}>How long?</h1>
          <p className="mt-2 mb-4 text-sm text-brand-muted">It shows on Home until then.</p>
          <div className="space-y-2">
            <button type="button" aria-pressed={scope === "week"} onClick={() => setScope("week")} className={choice(scope === "week")}>
              <span className="font-semibold text-brand-text">This week</span>
              <span className="text-sm text-brand-muted">{week !== null ? `Week ${week}` : "There's no current week yet"}</span>
            </button>
            <button type="button" aria-pressed={scope === "open"} onClick={() => setScope("open")} className={choice(scope === "open")}>
              <span className="font-semibold text-brand-text">Until I change it</span>
              <span className="text-sm text-brand-muted">Stays up until you feature something else</span>
            </button>
          </div>
          <h2 className="mb-2 mt-5 text-sm font-semibold text-brand-muted">How it will look</h2>
          <div className="rounded-[14px] border border-brand-border bg-brand-surface p-4">
            <p className="font-semibold text-brand-text">Featured: {item?.name}</p>
            {item && styleLine(item) && <p className="text-sm text-brand-muted">{styleLine(item)}</p>}
            {item && formatMenuPrice(item.priceCents) && <p className="text-sm text-brand-muted">{formatMenuPrice(item.priceCents)}</p>}
          </div>
        </>
      )}
    </Steps>
  );
}

// ---- Special ----

const DAYS = [
  { n: 1, short: "Mon" },
  { n: 2, short: "Tue" },
  { n: 3, short: "Wed" },
  { n: 4, short: "Thu" },
  { n: 5, short: "Fri" },
  { n: 6, short: "Sat" },
  { n: 0, short: "Sun" },
];

export function SpecialWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [tag, setTag] = useState<SpecialTag | null>(null);
  const [mode, setMode] = useState<"weekly" | "once">("weekly");
  const [days, setDays] = useState<number[]>([]);
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [done, setDone] = useState(false);
  const { busy, error, setError, submit } = useSubmit();

  if (done) return <Done title="Posted" text={mode === "weekly" ? `Players will see the special on ${scheduleText({ days, date: null, startTime: null, endTime: null })}.` : "Players will see the special on that day."} />;

  const schedule = { days: mode === "weekly" ? days : null, date: mode === "once" ? date : null, startTime: startTime || null, endTime: endTime || null };

  function problem(): string | null {
    if (step >= 1 && !title.trim()) return "Give the special a title.";
    if (step >= 2) {
      if (mode === "weekly" && days.length === 0) return "Pick at least one day.";
      if (mode === "once" && !date) return "Pick the date.";
      if (mode === "once" && date < easternToday(new Date())) return "That date has already gone.";
      if (endTime && !startTime) return "Add a start time, or clear the end time.";
      if (startTime && endTime && endTime <= startTime) return "The end has to be after the start.";
    }
    return null;
  }
  function next() {
    const p = problem();
    if (p) return setError(p);
    setError(null);
    setStep(step + 1);
  }

  return (
    <Steps
      step={step}
      total={3}
      onBack={() => (step === 1 ? navigate(BACK) : setStep(step - 1))}
      error={error}
      action={
        step < 3 ? (
          <button type="button" className={buttonClass} onClick={next}>
            Next
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            className={buttonClass}
            onClick={() =>
              void submit(
                "/brewery/specials",
                { title: title.trim(), details: details.trim() || null, tag, ...schedule },
                () => setDone(true)
              )
            }
          >
            Post it
          </button>
        )
      }
    >
      {step === 1 && (
        <>
          <h1 className={heading}>What's the special?</h1>
          <p className="mt-2 mb-4 text-sm text-brand-muted">Keep it short. Players read it on their phones.</p>
          <div className="space-y-4">
            <label className={label}>
              Title
              <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sunday football: wings and nachos" className={`${inputClass} mt-1`} />
            </label>
            <label className={label}>
              Details (optional)
              <input value={details} maxLength={200} onChange={(e) => setDetails(e.target.value)} placeholder="What's included?" className={`${inputClass} mt-1`} />
            </label>
            <div className="flex flex-wrap gap-2">
              {SPECIAL_TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tag === t}
                  onClick={() => setTag(tag === t ? null : t)}
                  className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${tag === t ? "border-brand-accent bg-brand-accent-soft text-brand-text" : "border-brand-border text-brand-muted"}`}
                >
                  {SPECIAL_TAG_TEXT[t]}
                </button>
              ))}
            </div>
            <p className="text-sm text-brand-muted">Describe the food or drink. Don't link a special to winning, losing or picks.</p>
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <h1 className={heading}>When is it on?</h1>
          <p className="mt-2 mb-4 text-sm text-brand-muted">A day and a time works best, like Sundays 1 to 4.</p>
          <div className="space-y-2">
            <button type="button" aria-pressed={mode === "weekly"} onClick={() => setMode("weekly")} className={choice(mode === "weekly")}>
              <span className="font-semibold text-brand-text">Every week</span>
              <span className="text-sm text-brand-muted">Pick the day and the time</span>
            </button>
            <button type="button" aria-pressed={mode === "once"} onClick={() => setMode("once")} className={choice(mode === "once")}>
              <span className="font-semibold text-brand-text">One day only</span>
              <span className="text-sm text-brand-muted">Pick the date</span>
            </button>
          </div>
          <div className="mt-4 space-y-4">
            {mode === "weekly" ? (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Days">
                {DAYS.map((d) => {
                  const on = days.includes(d.n);
                  return (
                    <button
                      key={d.n}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDays(on ? days.filter((x) => x !== d.n) : [...days, d.n])}
                      className={`min-h-11 min-w-12 rounded-full border px-3 text-sm font-semibold ${on ? "border-brand-accent bg-brand-accent-soft text-brand-text" : "border-brand-border text-brand-muted"}`}
                    >
                      {d.short}
                    </button>
                  );
                })}
              </div>
            ) : (
              <label className={label}>
                Date
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} mt-1`} />
              </label>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>
                From
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={`${inputClass} mt-1`} />
              </label>
              <label className={label}>
                Until
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={`${inputClass} mt-1`} />
              </label>
            </div>
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <h1 className={heading}>Ready to post it?</h1>
          <p className="mt-2 text-sm text-brand-muted">Players will see it on their Home screen on those days.</p>
          <h2 className="mb-2 mt-4 text-sm font-semibold text-brand-muted">How it will look</h2>
          <div className="rounded-[14px] border border-brand-border bg-brand-surface p-4">
            {tag && <p className="text-xs font-semibold uppercase tracking-wide text-brand-accent">{SPECIAL_TAG_TEXT[tag]}</p>}
            <p className="mt-1 font-semibold text-brand-text">{title.trim()}</p>
            {details.trim() && <p className="text-sm text-brand-muted">{details.trim()}</p>}
            <p className="text-sm text-brand-muted">{scheduleText(schedule)}</p>
          </div>
        </>
      )}
    </Steps>
  );
}

// ---- Announcement ----

const IDEAS = ["Watch with us", "New on tap", "Event night", "Kitchen special"];

export function AnnouncementWizard() {
  const navigate = useNavigate();
  const { data: summary } = useApi<AdminSummary>("/admin/summary");
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [which, setWhich] = useState<"this" | "next" | "other">("this");
  const [other, setOther] = useState("");
  const [done, setDone] = useState(false);
  const { busy, error, setError, submit } = useSubmit();

  const current = summary?.weekNumber ?? null;
  const weekNumber = which === "this" ? current : which === "next" ? (current === null ? null : current + 1) : Number(other) || null;

  if (done) return <Done title="Posted" text={`Players will see "${title.trim()}" on their Home screen for week ${weekNumber}.`} />;

  function next() {
    if (step === 1 && !title.trim()) return setError("Give it a short title.");
    if (step === 2 && !message.trim()) return setError("Write what players should know.");
    setError(null);
    setStep(step + 1);
  }

  return (
    <Steps
      step={step}
      total={3}
      onBack={() => (step === 1 ? navigate(BACK) : setStep(step - 1))}
      error={error}
      action={
        step < 3 ? (
          <button type="button" className={buttonClass} onClick={next}>
            Next
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || weekNumber === null}
            className={buttonClass}
            onClick={() => void submit("/brewery/announcements", { title: title.trim(), message: message.trim(), weekNumber }, () => setDone(true))}
          >
            Post it
          </button>
        )
      }
    >
      {step === 1 && (
        <>
          <h1 className={heading}>What's it about?</h1>
          <p className="mt-2 mb-4 text-sm text-brand-muted">Give it a short title. Players see it on their Home screen.</p>
          <label className={label}>
            Title
            <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Watch with us" className={`${inputClass} mt-1`} />
          </label>
          <p className="mb-2 mt-4 text-sm text-brand-muted">Or start from an idea:</p>
          <div className="flex flex-wrap gap-2">
            {IDEAS.map((i) => (
              <button key={i} type="button" onClick={() => setTitle(i)} className="min-h-11 rounded-full border border-brand-border px-4 text-sm font-semibold text-brand-muted">
                {i}
              </button>
            ))}
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <h1 className={heading}>What do you want to say?</h1>
          <p className="mt-2 mb-4 text-sm text-brand-muted">Keep it short and friendly. This is what players will see.</p>
          <label className={label}>
            Message
            <textarea value={message} rows={4} maxLength={300} onChange={(e) => setMessage(e.target.value)} className={`${inputClass} mt-1 py-2`} />
          </label>
          <h2 className="mb-2 mt-5 text-sm font-semibold text-brand-muted">How it will look</h2>
          <div className="rounded-[14px] border border-brand-border bg-brand-surface p-4">
            <p className="font-semibold text-brand-text">{title.trim()}</p>
            <p className="mt-1 text-sm text-brand-muted">{message.trim() || "Your message appears here."}</p>
          </div>
        </>
      )}
      {step === 3 && (
        <>
          <h1 className={heading}>When should it show?</h1>
          <p className="mt-2 mb-4 text-sm text-brand-muted">Pick the week. It disappears on its own afterwards.</p>
          <div className="space-y-2">
            <button type="button" aria-pressed={which === "this"} onClick={() => setWhich("this")} className={choice(which === "this")}>
              <span className="font-semibold text-brand-text">This week</span>
              <span className="text-sm text-brand-muted">{current !== null ? `Week ${current}, starting now` : "There's no current week yet"}</span>
            </button>
            <button type="button" aria-pressed={which === "next"} onClick={() => setWhich("next")} className={choice(which === "next")}>
              <span className="font-semibold text-brand-text">Next week</span>
              <span className="text-sm text-brand-muted">{current !== null ? `Week ${current + 1}` : ""}</span>
            </button>
            <button type="button" aria-pressed={which === "other"} onClick={() => setWhich("other")} className={choice(which === "other")}>
              <span className="font-semibold text-brand-text">Choose a week</span>
              <span className="text-sm text-brand-muted">Pick any week of the season</span>
            </button>
          </div>
          {which === "other" && (
            <label className={`${label} mt-3`}>
              Week number
              <input value={other} inputMode="numeric" onChange={(e) => setOther(e.target.value.replace(/\D/g, ""))} className={`${inputClass} mt-1`} />
            </label>
          )}
          <p className="mt-4 text-sm text-brand-muted">
            {title.trim()} shows {weekNumber !== null ? `week ${weekNumber}` : "once you pick a week"}.
          </p>
        </>
      )}
    </Steps>
  );
}
