import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { MenuItem, PublicMenu } from "@bbb/shared";
import { api, ApiError } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { buttonClass, secondaryButtonClass } from "../admin-pool/shared";
import { draftFromItem, toPayload, type Draft } from "./draft";
import { ExtraFields, NameFields } from "./fields";

// One item: change any detail, or take it off the menu for good.

export function EditItem() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data: menu, error: loadError } = useApi<PublicMenu>("/menu/items");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [item, setItem] = useState<MenuItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!menu || item) return;
    const found = [...menu.drinks, ...menu.kitchen].flatMap((s) => s.items).find((i) => i.id === id);
    if (found) {
      setItem(found);
      setDraft(draftFromItem(found));
    }
  }, [menu, id, item]);

  const back = item?.kind === "dish" ? "/admin/menu?tab=kitchen" : "/admin/menu";

  if (loadError && !menu) return <p className="px-6 pt-6 text-sm text-brand-muted">We couldn't load this item. Check your connection and try again.</p>;
  if (!menu) return null;
  if (!item || !draft) {
    return (
      <div className="mx-auto max-w-lg px-6 pt-6">
        <h1 className="text-3xl font-semibold text-brand-text">Not on the menu</h1>
        <p className="mt-2 text-sm text-brand-muted">This item has been removed, or it never existed.</p>
        <Link to="/admin/menu" className={`${buttonClass} mt-6`}>
          Back to the menu
        </Link>
      </div>
    );
  }

  const set = (patch: Partial<Draft>) => {
    setSaved(false);
    setDraft({ ...draft, ...patch });
  };

  async function save() {
    const r = toPayload(draft!);
    if (!r.ok) return setMessage(r.error);
    setBusy(true);
    setMessage(null);
    try {
      const updated = await api<MenuItem>(`/menu/items/${id}`, { method: "PATCH", body: JSON.stringify(r.body) });
      setItem(updated);
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
      await api(`/menu/items/${id}`, { method: "DELETE" });
      navigate(back, { replace: true });
    } catch (e) {
      setMessage(`${e instanceof ApiError ? e.message : "Something went wrong"}. Nothing was removed.`);
      setBusy(false);
    }
  }

  const sections = menu.kitchen.map((s) => s.name);
  return (
    <div className="mx-auto max-w-lg px-6 pb-6 pt-4">
      <Link to={back} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-muted">
        Back
      </Link>
      <h1 className="text-3xl font-semibold leading-tight text-brand-text">{item.name}</h1>
      <p className="mt-1 text-sm text-brand-muted">Edit the details below.</p>
      <div className="mt-4 space-y-4">
        <NameFields draft={draft} set={set} sections={sections} />
        <ExtraFields draft={draft} set={set} />
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
        <h2 className="font-semibold text-brand-text">Remove from the menu</h2>
        <p className="mt-1 text-sm text-brand-muted">This takes it off the menu for good. To bring it back later you would add it again.</p>
        {confirming ? (
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy} onClick={() => void remove()} className={`${buttonClass} !bg-brand-danger`}>
              Yes, remove it
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={secondaryButtonClass}>
              Keep it
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className={`${secondaryButtonClass} mt-3`}>
            Remove {item.name}
          </button>
        )}
      </section>
    </div>
  );
}
