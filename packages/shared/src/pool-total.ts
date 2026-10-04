// The pool total is a display-only number an admin types in. The app never handles money.
// Held as whole cents so no floating-point money is stored. No Node imports: bundled into the browser.

export const MAX_POOL_TOTAL_CENTS = 100_000_000; // $1,000,000.00

export const POOL_TOTAL_NOTE = "Cash handled at the bar, not in this app.";

const MSG = {
  notNumber: "Enter the amount as a number, like 320 or 320.50.",
  negative: "Enter an amount of $0 or more.",
  tooLarge: "That amount is too large.",
};

export type ParsedPoolTotal = { ok: true; cents: number | null } | { ok: false; message: string };

/** Turns what an admin typed into cents. Empty means "clear the total" (null). */
export function parsePoolTotal(input: string): ParsedPoolTotal {
  const text = input.trim().replace(/^\$\s*/, "").replace(/,/g, "");
  if (text === "") return { ok: true, cents: null };
  if (/^-\s*\d/.test(text)) return { ok: false, message: MSG.negative };
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return { ok: false, message: MSG.notNumber };
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > MAX_POOL_TOTAL_CENTS) return { ok: false, message: MSG.tooLarge };
  return { ok: true, cents };
}

/** "$320" for whole dollars, "$320.50" otherwise. */
export function formatPoolTotal(cents: number): string {
  const dollars = Math.floor(cents / 100);
  const rest = cents % 100;
  const whole = dollars.toLocaleString("en-US");
  return rest === 0 ? `$${whole}` : `$${whole}.${String(rest).padStart(2, "0")}`;
}

/** What to put back in the admin's field for an existing total ("320" or "320.50"). */
export function poolTotalToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const rest = cents % 100;
  const dollars = Math.floor(cents / 100);
  return rest === 0 ? String(dollars) : `${dollars}.${String(rest).padStart(2, "0")}`;
}
