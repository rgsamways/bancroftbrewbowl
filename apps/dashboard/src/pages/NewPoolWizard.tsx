import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import type { PoolType } from "@bbb/shared";
import { api, ApiError } from "../lib/api";
import { FocusBar } from "../components/AdminLayout";
import { buttonClass, inputClass, kindLabel, secondaryButtonClass } from "./admin-pool/shared";

const RULE_SUMMARY: Record<PoolType, [string, string][]> = {
  survivor: [
    ["Picks", "One team a week"],
    ["Same team twice", "Not allowed"],
    ["A tied game", "Knocks you out"],
    ["Picks lock", "At each game's kickoff"],
  ],
  pick_em: [
    ["Picks", "Every game, every week"],
    ["Points", "One for each correct pick"],
    ["A tied game", "Doesn't score"],
    ["Picks lock", "At each game's kickoff"],
  ],
};

const TYPE_TEXT: Record<PoolType, string> = {
  survivor: "Everyone picks one team a week. If your team loses, you're out. Last one standing wins.",
  pick_em: "Everyone picks the winner of every game. A point for each right pick. Most points wins.",
};

type Created = { id: string; name: string };

/** Open a new pool in four steps. "Open the pool" creates it and locks its rules. */
export function NewPoolWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [type, setType] = useState<PoolType>("survivor");
  const [season, setSeason] = useState<number>(new Date().getFullYear());
  const [seasons, setSeasons] = useState<number[]>([]);
  const [created, setCreated] = useState<Created | null>(null);
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<number[]>("/nfl/seasons")
      .then((list) => {
        setSeasons(list);
        if (list[0]) setSeason(list[0]); // newest first
      })
      .catch(() => undefined);
  }, []);

  const seasonOptions = [...new Set([...seasons, season])].sort((a, b) => b - a);

  async function create(): Promise<Created | null> {
    // The pool may already exist if opening it failed half way: reuse it rather than make a second.
    if (created) return created;
    const pool = await api<Created>("/pools", { method: "POST", body: JSON.stringify({ name: name.trim(), season_year: season, type }) });
    setCreated(pool);
    return pool;
  }

  async function open() {
    setBusy(true);
    setError(null);
    let pool: Created | null = null;
    try {
      pool = await create();
      await api(`/pools/${pool!.id}`, { method: "PATCH", body: JSON.stringify({ status: "active" }) });
      setOpened(true);
    } catch (e) {
      setError(
        pool
          ? `${name.trim()} was created but could not be opened (${e instanceof ApiError ? e.message : "something went wrong"}). Tap the button to try again.`
          : `${e instanceof ApiError ? e.message : "Something went wrong"}. The pool was not created.`
      );
    } finally {
      setBusy(false);
    }
  }

  async function changeARule() {
    setBusy(true);
    setError(null);
    try {
      const pool = await create();
      navigate(`/admin/pools/${pool!.id}?tab=settings`, { replace: true });
    } catch (e) {
      setError(`${e instanceof ApiError ? e.message : "Something went wrong"}. The pool was not created.`);
      setBusy(false);
    }
  }

  if (opened && created) {
    return (
      <>
        <FocusBar leaveTo="/admin/pools" />
        <h1 className="mt-6 text-3xl font-semibold leading-tight text-brand-text">{created.name} is open</h1>
        <p className="mt-2 text-sm text-brand-muted">Players can join now. Share this link:</p>
        <p className="mt-3 break-all rounded-[14px] border border-brand-border bg-brand-surface p-4 text-brand-text">{window.location.origin}</p>
        <Link to={`/admin/pools/${created.id}`} className={`${secondaryButtonClass} mt-6`}>
          See the pool
        </Link>
        <Link to="/admin" className={`${buttonClass} mt-3`}>
          Back to your steps
        </Link>
      </>
    );
  }

  return (
    <>
      <FocusBar label={`Step ${step} of 4`} onBack={step > 1 ? () => setStep(step - 1) : () => navigate("/admin/pools")} leaveTo="/admin/pools" />

      {step === 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) setStep(2);
          }}
        >
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-brand-text">Name your pool</h1>
          <p className="mt-1 text-sm text-brand-muted">Players will see this name. You can change it until you open the pool.</p>
          <label className="mt-5 block text-sm font-semibold text-brand-text">
            Pool name
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Sunday Survivor" className={`${inputClass} mt-1`} />
          </label>
          <button type="submit" disabled={!name.trim()} className={`${buttonClass} mt-5`}>
            Next
          </button>
        </form>
      )}

      {step === 2 && (
        <>
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-brand-text">How will people play?</h1>
          <div className="mt-5 space-y-3">
            {(["survivor", "pick_em"] as PoolType[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setType(t)}
                className={`w-full rounded-[14px] border p-4 text-left ${type === t ? "border-brand-accent bg-brand-accent-soft" : "border-brand-border bg-brand-surface"}`}
              >
                <span className="block font-semibold text-brand-text">{kindLabel(t)}</span>
                <span className="mt-1 block text-sm text-brand-muted">{TYPE_TEXT[t]}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-brand-muted">You can't change this later.</p>
          <button type="button" onClick={() => setStep(3)} className={`${buttonClass} mt-5`}>
            Next
          </button>
        </>
      )}

      {step === 3 && (
        <>
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-brand-text">Check the rules</h1>
          <ul className="mt-5 overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
            {RULE_SUMMARY[type].map(([k, v]) => (
              <li key={k} className="flex items-center justify-between gap-3 border-b border-brand-border px-4 py-3 last:border-b-0">
                <span className="text-sm text-brand-muted">{k}</span>
                <span className="text-brand-text">{v}</span>
              </li>
            ))}
          </ul>
          {error && (
            <p role="alert" className="mt-3 text-sm text-brand-danger">
              {error}
            </p>
          )}
          <button type="button" onClick={() => setStep(4)} className={`${buttonClass} mt-5`}>
            These look right
          </button>
          <button type="button" disabled={busy} onClick={() => void changeARule()} className={`${secondaryButtonClass} mt-3`}>
            Change a rule
          </button>
          <p className="mt-2 text-xs text-brand-muted">Changing a rule creates the pool unlocked and opens its settings.</p>
        </>
      )}

      {step === 4 && (
        <>
          <h1 className="mt-4 text-3xl font-semibold leading-tight text-brand-text">Ready to open?</h1>
          <p className="mt-1 text-sm text-brand-muted">
            Opening the pool locks the rules and lets players join. You can unlock them later in Settings.
          </p>
          <ul className="mt-5 overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
            <li className="flex items-center justify-between gap-3 border-b border-brand-border px-4 py-3">
              <span className="text-sm text-brand-muted">Name</span>
              <span className="text-brand-text">{name.trim()}</span>
            </li>
            <li className="flex items-center justify-between gap-3 border-b border-brand-border px-4 py-3">
              <span className="text-sm text-brand-muted">Type</span>
              <span className="text-brand-text">{kindLabel(type)}</span>
            </li>
            <li className="flex items-center justify-between gap-3 px-4 py-3">
              <label htmlFor="season" className="text-sm text-brand-muted">
                Season
              </label>
              <select
                id="season"
                value={season}
                disabled={created !== null}
                onChange={(e) => setSeason(Number(e.target.value))}
                className="min-h-11 rounded-[10px] border border-brand-border bg-brand-bg px-3 text-brand-text"
              >
                {seasonOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </li>
          </ul>
          {error && (
            <p role="alert" className="mt-3 text-sm text-brand-danger">
              {error}
            </p>
          )}
          <button type="button" disabled={busy} onClick={() => void open()} className={`${buttonClass} mt-5`}>
            Open the pool
          </button>
        </>
      )}
    </>
  );
}
