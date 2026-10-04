import { z } from "zod";

// The menu: drinks and dishes anyone can read, kept current by admins. No Node imports.

export const MENU_KINDS = ["beer", "wine", "drink", "dish"] as const;
export type MenuKind = (typeof MENU_KINDS)[number];

export const MENU_LABELS = ["new", "seasonal"] as const;
export type MenuLabel = (typeof MENU_LABELS)[number];

/** Drinks live in fixed sections; a dish names its own (for example "Smokehouse plates"). */
export const DRINK_SECTIONS: Record<Exclude<MenuKind, "dish">, string> = {
  beer: "On tap",
  wine: "Wine",
  drink: "Other drinks",
};
export const DRINK_SECTION_ORDER = [DRINK_SECTIONS.beer, DRINK_SECTIONS.wine, DRINK_SECTIONS.drink] as const;

export const MAX_MENU_PRICE_CENTS = 100_000;
export const MAX_MENU_OPTIONS = 12;

export const menuOptionSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    priceCents: z.number().int().min(0).max(MAX_MENU_PRICE_CENTS).nullable().default(null),
  })
  .strict();
export type MenuOption = z.infer<typeof menuOptionSchema>;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

const menuItemFields = {
  kind: z.enum(MENU_KINDS),
  /** Only used for dishes; drinks always go in their fixed section. */
  section: z.string().trim().max(60).optional(),
  name: z.string().trim().min(1).max(80),
  style: optionalText(40),
  abv: optionalText(10),
  description: optionalText(300),
  priceCents: z.number().int().min(0).max(MAX_MENU_PRICE_CENTS).nullish().transform((v) => v ?? null),
  options: z.array(menuOptionSchema).max(MAX_MENU_OPTIONS).default([]),
  labels: z
    .array(z.enum(MENU_LABELS))
    .max(MENU_LABELS.length)
    .default([])
    .refine((l) => new Set(l).size === l.length, { message: "Duplicate label" }),
};

export const createMenuItemSchema = z
  .object(menuItemFields)
  .strict()
  .refine((v) => v.kind !== "dish" || Boolean(v.section), { message: "A dish needs a section", path: ["section"] });
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;

/** Editing resends the whole item (the form always has every field); the kind cannot change. */
export const updateMenuItemSchema = z
  .object({ ...menuItemFields, kind: z.enum(MENU_KINDS).optional() })
  .strict()
  .refine((v) => v.kind !== "dish" || Boolean(v.section), { message: "A dish needs a section", path: ["section"] });
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;

export const menuAvailabilitySchema = z.object({ available: z.boolean() }).strict();

/** What the public menu (and the admin list) sends for one item. */
export type MenuItem = {
  id: string;
  kind: MenuKind;
  section: string;
  name: string;
  style: string | null;
  abv: string | null;
  description: string | null;
  priceCents: number | null;
  options: MenuOption[];
  labels: MenuLabel[];
  available: boolean;
};

export type MenuSection = { name: string; items: MenuItem[] };
/** Drinks (fixed sections, always all three) and kitchen (sections in the order first added). */
export type PublicMenu = { drinks: MenuSection[]; kitchen: MenuSection[] };

/** "$18", "$4.50"; null when there is no price. */
export function formatMenuPrice(cents: number | null): string | null {
  if (cents === null) return null;
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

/** The line under a beer's name: "IPA · 6.2%". Either part may be missing. */
export function styleLine(item: Pick<MenuItem, "style" | "abv">): string | null {
  const parts = [item.style, item.abv].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}
