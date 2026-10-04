// What other players are shown for a person. A new account is named with its email address
// until the player sets a display name, and an email must never reach another player's screen.
// No Node imports: bundled into the browser.

/** The name to show other players: the display name, else the invited name, else "A player".
 * A name that is empty or contains an "@" is shortened to the part before the "@" (and to
 * "A player" if nothing is left), so an address is never shown. */
export function publicName(name?: string | null, invitedName?: string | null): string {
  const pick = [name, invitedName].map((n) => (n ?? "").trim()).find((n) => n !== "") ?? "";
  const shown = pick.includes("@") ? pick.slice(0, pick.indexOf("@")).trim() : pick;
  return shown === "" ? "A player" : shown;
}

/** True when the account has no real display name yet (empty, or it is the email address). */
export function needsDisplayName(name?: string | null): boolean {
  const n = (name ?? "").trim();
  return n === "" || n.includes("@");
}
