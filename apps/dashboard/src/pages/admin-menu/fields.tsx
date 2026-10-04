import { MENU_LABELS } from "@bbb/shared";
import { inputClass } from "../admin-pool/shared";
import { LABEL_TEXT, type Draft } from "./draft";

// The form fields shared by the add wizard (spread over steps) and the edit screen (all at once).

type Props = { draft: Draft; set: (patch: Partial<Draft>) => void; sections?: string[] };

const label = "block text-sm font-semibold text-brand-text";

export function NameFields({ draft, set, sections = [] }: Props) {
  const isDish = draft.kind === "dish";
  return (
    <div className="space-y-4">
      <label className={label}>
        Name
        <input
          value={draft.name}
          maxLength={80}
          onChange={(e) => set({ name: e.target.value })}
          placeholder={isDish ? "e.g. Smoked brisket sandwich" : "e.g. Hawkwatch IPA"}
          className={`${inputClass} mt-1`}
        />
      </label>
      {isDish ? (
        <label className={label}>
          Goes under
          <input
            value={draft.section}
            maxLength={60}
            list="menu-sections"
            onChange={(e) => set({ section: e.target.value })}
            placeholder="e.g. Smokehouse plates"
            className={`${inputClass} mt-1`}
          />
          <datalist id="menu-sections">
            {sections.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
      ) : (
        <label className={label}>
          Style (optional)
          <input value={draft.style} maxLength={40} onChange={(e) => set({ style: e.target.value })} placeholder="e.g. IPA" className={`${inputClass} mt-1`} />
        </label>
      )}
    </div>
  );
}

export function ExtraFields({ draft, set }: Props) {
  const isDish = draft.kind === "dish";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {!isDish && (
          <label className={label}>
            Strength
            <input value={draft.abv} maxLength={10} onChange={(e) => set({ abv: e.target.value })} placeholder="e.g. 6.2%" className={`${inputClass} mt-1`} />
          </label>
        )}
        <label className={label}>
          Price
          <input
            value={draft.price}
            inputMode="decimal"
            onChange={(e) => set({ price: e.target.value })}
            placeholder="Leave blank"
            className={`${inputClass} mt-1`}
          />
        </label>
      </div>
      <label className={label}>
        Short description (optional)
        <input
          value={draft.description}
          maxLength={300}
          onChange={(e) => set({ description: e.target.value })}
          placeholder={isDish ? "What is in it" : "A line or two about it"}
          className={`${inputClass} mt-1`}
        />
      </label>
      <fieldset>
        <legend className={`${label} mb-1`}>Labels</legend>
        <div className="flex gap-2">
          {MENU_LABELS.map((l) => {
            const on = draft.labels.includes(l);
            return (
              <button
                key={l}
                type="button"
                aria-pressed={on}
                onClick={() => set({ labels: on ? draft.labels.filter((x) => x !== l) : [...draft.labels, l] })}
                className={`min-h-11 flex-1 rounded-[12px] border text-sm font-semibold ${
                  on ? "border-brand-accent bg-brand-accent-soft text-brand-text" : "border-brand-border text-brand-muted"
                }`}
              >
                {LABEL_TEXT[l]}
              </button>
            );
          })}
        </div>
      </fieldset>
      {isDish && (
        <label className={label}>
          Add-ons or choices (optional)
          <textarea
            value={draft.options}
            rows={4}
            onChange={(e) => set({ options: e.target.value })}
            placeholder={"One per line. Put a price after a comma:\nAdd turkey, 7\nAdd brisket, 9"}
            className={`${inputClass} mt-1 py-2`}
          />
        </label>
      )}
      <p className="text-sm text-brand-muted">A price is optional. If you leave it blank, players just don't see one.</p>
    </div>
  );
}
