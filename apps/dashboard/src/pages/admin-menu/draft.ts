import { MENU_LABELS, type CreateMenuItemInput, type MenuItem, type MenuKind, type MenuLabel } from "@bbb/shared";

// What the add and edit forms hold while someone types, and the conversion to and from what the
// server stores. Kept free of React so it can be tested directly.

export type Draft = {
  kind: MenuKind;
  section: string;
  name: string;
  style: string;
  abv: string;
  description: string;
  price: string;
  options: string;
  labels: MenuLabel[];
};

export const emptyDraft = (kind: MenuKind): Draft => ({
  kind,
  section: "",
  name: "",
  style: "",
  abv: "",
  description: "",
  price: "",
  options: "",
  labels: [],
});

export const KIND_TEXT: Record<MenuKind, string> = { beer: "beer", wine: "wine", drink: "drink", dish: "dish" };
export const LABEL_TEXT: Record<MenuLabel, string> = { new: "New", seasonal: "Seasonal" };
export { MENU_LABELS };

/** "18", "$18", "4.5" or "4.50" to cents; "" to null; anything else to undefined. */
export function parsePrice(text: string): number | null | undefined {
  const t = text.trim().replace(/^\$/, "");
  if (t === "") return null;
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(t)) return undefined;
  return Math.round(Number(t) * 100);
}

const dollars = (cents: number) => (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));

/** One option per line: "Brisket, 9" is an add-on that costs $9, "Coleslaw" has no price. */
export function parseOptions(text: string): { name: string; priceCents: number | null }[] | undefined {
  const out: { name: string; priceCents: number | null }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const cut = line.lastIndexOf(",");
    const tail = cut >= 0 ? line.slice(cut + 1).trim() : "";
    if (cut >= 0 && /^\$?\d/.test(tail)) {
      const priceCents = parsePrice(tail);
      if (priceCents === undefined || priceCents === null) return undefined;
      out.push({ name: line.slice(0, cut).trim(), priceCents });
    } else {
      out.push({ name: line, priceCents: null });
    }
  }
  return out;
}

export function optionsText(options: MenuItem["options"]): string {
  return options.map((o) => (o.priceCents === null ? o.name : `${o.name}, ${dollars(o.priceCents)}`)).join("\n");
}

export function draftFromItem(item: MenuItem): Draft {
  return {
    kind: item.kind,
    section: item.kind === "dish" ? item.section : "",
    name: item.name,
    style: item.style ?? "",
    abv: item.abv ?? "",
    description: item.description ?? "",
    price: item.priceCents === null ? "" : dollars(item.priceCents),
    options: optionsText(item.options),
    labels: item.labels,
  };
}

/** The body to send, or the first problem to tell the person about. */
export function toPayload(d: Draft): { ok: true; body: CreateMenuItemInput } | { ok: false; error: string } {
  if (!d.name.trim()) return { ok: false, error: "Give it a name." };
  if (d.kind === "dish" && !d.section.trim()) return { ok: false, error: "Say which part of the menu it goes under." };
  const priceCents = parsePrice(d.price);
  if (priceCents === undefined) return { ok: false, error: "Enter the price as a number, like 18 or 4.50, or leave it blank." };
  const options = parseOptions(d.options);
  if (options === undefined) return { ok: false, error: "Each add-on or choice goes on its own line. Put the price after a comma, like Brisket, 9." };
  if (options.length > 12) return { ok: false, error: "That is too many add-ons or choices. The most is 12." };
  return {
    ok: true,
    body: {
      kind: d.kind,
      ...(d.kind === "dish" ? { section: d.section.trim() } : {}),
      name: d.name.trim(),
      style: d.style.trim() || null,
      abv: d.abv.trim() || null,
      description: d.description.trim() || null,
      priceCents,
      options,
      labels: d.labels,
    },
  };
}
