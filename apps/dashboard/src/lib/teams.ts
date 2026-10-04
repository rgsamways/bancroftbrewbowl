import { NFL_TEAMS } from "@bbb/shared";

const byCode = new Map<string, string>(NFL_TEAMS.map((t) => [t.code, t.name]));

/** "Kansas City Chiefs" (falls back to the code). */
export function teamName(code: string): string {
  return byCode.get(code) ?? code;
}

/** "Chiefs": the last word of the name, which is the nickname for every NFL team. */
export function teamNickname(code: string): string {
  const name = teamName(code);
  return name.split(" ").slice(-1)[0] ?? name;
}
