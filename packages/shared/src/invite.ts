// Inviting people and bringing them back to where they were going. No Node imports.

function hasUnsafeCharacter(path: string): boolean {
  for (const ch of path) {
    const code = ch.charCodeAt(0);
    if (ch === "\\" || /\s/.test(ch) || code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/** The page to return to after signing in. Only a plain page inside the app is ever used: anything
 * else (another site, a protocol, "//host", backslashes, control characters, spaces, an over-long
 * address) becomes Home. */
export function safeDestination(path: string | null | undefined): string {
  if (!path || path.length > 500) return "/";
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  if (hasUnsafeCharacter(path)) return "/";
  if (path.split(/[?#]/)[0]!.includes("//")) return "/";
  try {
    // Resolved against a made-up origin, a real in-app path stays on that origin.
    if (new URL(path, "https://app.invalid").origin !== "https://app.invalid") return "/";
  } catch {
    return "/";
  }
  return path;
}

/** The join page's address for a pool, or null when the pool is finished and takes no one new. */
export function joinPathFor(pool: { id: string; status: string }): string | null {
  return pool.status === "completed" ? null : `/join/${pool.id}`;
}

/** The message that goes with a shared join link. It names only the pool. */
export function inviteMessage(poolName: string): string {
  return `Join me in ${poolName} at Bancroft Brewing's Brew Bowl`;
}
