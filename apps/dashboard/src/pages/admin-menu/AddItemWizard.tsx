import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { MENU_KINDS, formatMenuPrice, styleLine, type MenuKind, type PublicMenu } from "@bbb/shared";
import { api, ApiError } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { FocusBar } from "../../components/AdminLayout";
import { buttonClass, secondaryButtonClass } from "../admin-pool/shared";
import { emptyDraft, LABEL_TEXT, toPayload, type Draft } from "./draft";
import { ExtraFields, NameFields } from "./fields";

// Adding a beer, wine, drink or dish one question at a time. It goes on the menu straight away.

const KIND_CHOICES: { kind: MenuKind; title: string; hint: string }[] = [
  { kind: "beer", title: "A beer", hint: "Something on tap" },
  { kind: "wine", title: "A wine", hint: "A glass or a bottle" },
  { kind: "drink", title: "Another drink", hint: "Anything else to sip" },
  { kind: "dish", title: "A dish", hint: "Something from the kitchen" },
];

const TOTAL = 4;
const heading = "mt-2 text-3xl font-semibold leading-tight text-brand-text";

export function AddItemWizard() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const start = MENU_KINDS.find((k) => k === params.get("kind")) ?? "beer";
  const { data: menu } = useApi<PublicMenu>("/menu/items");
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(emptyDraft(start));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const sections = menu?.kitchen.map((s) => s.name) ?? [];

  if (added) {
    return (
      <>
        <FocusBar />
        <h1 className={`${heading} mt-6`}>Added to the menu</h1>
        <p className="mt-2 text-sm text-brand-muted">Players can see {added} now.</p>
        <Link to={`/admin/menu${draft.kind === "dish" ? "?tab=kitchen" : ""}`} className={`${buttonClass} mt-6`}>
          Back to the menu
        </Link>
        <button
          type="button"
          onClick={() => {
            setDraft(emptyDraft(draft.kind));
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
    if (step === 2) {
      if (!draft.name.trim()) return setError("Give it a name.");
      if (draft.kind === "dish" && !draft.section.trim()) return setError("Say which part of the menu it goes under.");
    }
    if (step === 3) {
      const r = toPayload(draft);
      if (!r.ok) return setError(r.error);
    }
    setStep(step + 1);
  }

  async function submit() {
    const r = toPayload(draft);
    if (!r.ok) return setError(r.error);
    setBusy(true);
    setError(null);
    try {
      await api("/menu/items", { method: "POST", body: JSON.stringify(r.body) });
      setAdded(r.body.name);
    } catch (e) {
      setError(`${e instanceof ApiError ? e.message : "Something went wrong"}. Nothing was added.`);
    }
    setBusy(false);
  }

  const price = formatMenuPrice(toPayload(draft).ok ? (toPayload(draft) as { body: { priceCents: number | null } }).body.priceCents : null);
  const typeText = KIND_CHOICES.find((k) => k.kind === draft.kind)!.title.replace(/^An? /, "");

  return (
    <>
      <FocusBar label={`Step ${step} of ${TOTAL}`} onBack={() => (step === 1 ? navigate("/admin/menu") : setStep(step - 1))} />
      {step === 1 && (
        <>
          <h1 className={heading}>What are you adding?</h1>
          <p className="mt-2 text-sm text-brand-muted">Pick one. You can add the others after.</p>
          <div className="mt-4 space-y-2">
            {KIND_CHOICES.map((c) => (
              <button
                key={c.kind}
                type="button"
                aria-pressed={draft.kind === c.kind}
                onClick={() => set({ kind: c.kind })}
                className={`flex min-h-14 w-full flex-col justify-center rounded-[14px] border px-4 text-left ${
                  draft.kind === c.kind ? "border-brand-accent bg-brand-accent-soft" : "border-brand-border bg-brand-surface"
                }`}
              >
                <span className="font-semibold text-brand-text">{c.title}</span>
                <span className="text-sm text-brand-muted">{c.hint}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <h1 className={heading}>What's it called?</h1>
          <p className="mt-2 mb-4 text-sm text-brand-muted">Just the name players will see.</p>
          <NameFields draft={draft} set={set} sections={sections} />
        </>
      )}
      {step === 3 && (
        <>
          <h1 className={heading}>Anything else?</h1>
          <p className="mt-2 mb-4 text-sm text-brand-muted">All of this is optional. Skip what you don't need.</p>
          <ExtraFields draft={draft} set={set} />
        </>
      )}
      {step === 4 && (
        <>
          <h1 className={heading}>Ready to add it?</h1>
          <p className="mt-2 text-sm text-brand-muted">Players will see it in the Menu tab straight away.</p>
          <dl className="mt-4 divide-y divide-brand-border overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface text-sm">
            {(
              [
                ["Name", draft.name.trim()],
                ["Type", typeText],
                ...(draft.kind === "dish" ? [["Goes under", draft.section.trim()]] : []),
                ["Style", styleLine({ style: draft.style.trim() || null, abv: draft.abv.trim() || null })],
                ["Price", price],
                ["Labels", draft.labels.map((l) => LABEL_TEXT[l]).join(", ")],
              ] as [string, string | null][]
            )
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-brand-muted">{k}</dt>
                  <dd className="text-right text-brand-text">{v}</dd>
                </div>
              ))}
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
            Add to the menu
          </button>
        )}
      </div>
    </>
  );
}
