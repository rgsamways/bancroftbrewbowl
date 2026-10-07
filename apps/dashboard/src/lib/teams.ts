import { NFL_TEAMS, readableOn, TEAM_COLORS, type TeamCode } from "@bbb/shared";

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

/** Inline style for a team's colour circle: its main colour, with readable text and a faint ring so
 * a dark team (Bears, Raiders) still shows against the dark screen. */
export function teamCircleStyle(code: string) {
  const bg = TEAM_COLORS[code as TeamCode] ?? "#3d3d41";
  return { backgroundColor: bg, color: readableOn(bg), boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.22)" };
}

