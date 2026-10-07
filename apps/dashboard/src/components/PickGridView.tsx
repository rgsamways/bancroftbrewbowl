import { formatRank, type GridCell, type GridResult, type GridRow, type PickGrid } from "@bbb/shared";
import { useApi } from "../lib/useApi";
import { teamCircleStyle, teamNickname } from "../lib/teams";

const RING: Record<GridResult, string> = {
  win: "outline outline-2 outline-offset-1 outline-brand-success",
  loss: "outline outline-2 outline-offset-1 outline-brand-danger",
  tie: "outline outline-2 outline-offset-1 outline-brand-muted",
  pending: "",
};
const WORD: Record<GridResult, string> = { win: "won", loss: "lost", tie: "tied", pending: "still to play" };

function TeamDot({ team, result, small }: { team: string; result: GridResult; small?: boolean }) {
  return (
    <span
      title={`${teamNickname(team)}, ${WORD[result]}`}
      style={teamCircleStyle(team)}
      className={`grid flex-none place-items-center rounded-full font-bold ${small ? "h-5 w-5 text-[7px]" : "h-7 w-7 text-[9px]"} ${RING[result]}`}
    >
      {team}
    </span>
  );
}

function Cell({ cell }: { cell: GridCell }) {
  if (cell.kind === "picks") {
    const label = cell.picks.map((p) => `${teamNickname(p.team)}, ${WORD[p.result]}`).join("; ");
    return (
      <span data-testid="grid-cell" data-kind="picks" aria-label={label} className="flex items-center justify-center gap-1">
        {cell.picks.map((p) => (
          <TeamDot key={p.team} team={p.team} result={p.result} small={cell.picks.length > 1} />
        ))}
      </span>
    );
  }
  if (cell.kind === "hidden") {
    return (
      <span data-testid="grid-cell" data-kind="hidden" aria-label="Picked, not shown yet" className="block text-center text-brand-faint">
        &bull;
      </span>
    );
  }
  if (cell.kind === "points") {
    return (
      <span data-testid="grid-cell" data-kind="points" title={`${cell.correct} of ${cell.of}`} className="block text-center font-semibold tabular-nums text-brand-text">
        {cell.correct}
      </span>
    );
  }
  return (
    <span data-testid="grid-cell" data-kind="empty" aria-label="No pick shown" className="block text-center text-brand-faint">
      &ndash;
    </span>
  );
}

function PlayerCell({ row }: { row: GridRow }) {
  return (
    <th
      scope="row"
      className={`sticky left-0 z-10 max-w-[8.5rem] border-b border-r border-brand-border px-3 py-2 text-left font-normal ${
        row.isYou ? "bg-brand-accent-soft" : "bg-brand-surface"
      }`}
    >
      <span className="block truncate text-brand-text">
        {row.name}
        {row.isYou && <span className="ml-1.5 text-xs font-semibold text-brand-accent">You</span>}
      </span>
      {row.status === "eliminated" && <span className="block text-xs text-brand-faint">Out in week {row.eliminatedWeek ?? "?"}</span>}
    </th>
  );
}

/** Week by week: who picked which team each week (survivor) or how many they got right (pick 'em).
 * Everything here was already filtered by the server for what this viewer may see. */
export function PickGridView({ poolId }: { poolId: string }) {
  const { data: grid, error } = useApi<PickGrid>(`/pools/${poolId}/pick-grid`);

  if (error && !grid) return <p className="text-sm text-brand-muted">We couldn't load the week-by-week view. Try again in a moment.</p>;
  if (!grid) return null;

  const survivor = grid.pool.type === "survivor";
  if (grid.weeks.length === 0) {
    return (
      <section data-testid="pick-grid" className="rounded-[14px] border border-brand-border bg-brand-surface p-4">
        <p className="font-semibold text-brand-text">Nothing to show yet</p>
        <p className="mt-1 text-sm text-brand-muted">Picks appear here week by week as the games start.</p>
      </section>
    );
  }

  return (
    <section data-testid="pick-grid" aria-label="Week by week">
      {grid.teamsUsed && (
        <p className="mb-3 text-sm text-brand-muted">
          {grid.teamsUsed.repeatsAllowed
            ? "Teams can be used again in this pool."
            : `You've used ${grid.teamsUsed.used} of ${grid.teamsUsed.total} teams, so ${grid.teamsUsed.total - grid.teamsUsed.used} are left.`}
        </p>
      )}
      <div className="overflow-x-auto rounded-[14px] border border-brand-border bg-brand-surface">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Week by week for {grid.pool.name}</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 border-b border-r border-brand-border bg-brand-surface px-3 py-2 text-left text-xs font-semibold text-brand-muted">
                Player
              </th>
              {grid.weeks.map((w) => (
                <th key={w} scope="col" className="min-w-14 border-b border-brand-border px-1 py-2 text-center text-xs font-semibold text-brand-muted">
                  W{w}
                </th>
              ))}
              {!survivor && (
                <th scope="col" className="min-w-16 border-b border-l border-brand-border px-2 py-2 text-center text-xs font-semibold text-brand-muted">
                  Total
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => (
              <tr key={row.entryId} data-testid="grid-row" className={row.status === "eliminated" ? "opacity-60" : ""}>
                <PlayerCell row={row} />
                {row.cells.map((cell, i) => (
                  <td key={grid.weeks[i]} className={`border-b border-brand-border px-1 py-2 ${row.isYou ? "bg-brand-accent-soft" : ""}`}>
                    <Cell cell={cell} />
                  </td>
                ))}
                {!survivor && (
                  <td className={`border-b border-l border-brand-border px-2 py-2 text-center ${row.isYou ? "bg-brand-accent-soft" : ""}`}>
                    <span className="font-semibold tabular-nums text-brand-text">{row.total ?? 0}</span>
                    {row.rank !== undefined && <span className="block text-xs text-brand-faint">{formatRank({ rank: row.rank, tied: Boolean(row.tied) })}</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {survivor && (
            <tfoot>
              <tr>
                <th scope="row" className="sticky left-0 z-10 border-r border-brand-border bg-brand-surface px-3 py-2 text-left text-xs font-semibold text-brand-muted">
                  Most picked
                </th>
                {grid.mostPicked.map((m, i) => (
                  <td key={grid.weeks[i]} className="px-1 py-2 text-center">
                    {m ? (
                      <span className="flex flex-col items-center gap-0.5">
                        <TeamDot team={m.team} result="pending" small />
                        <span className="text-xs tabular-nums text-brand-muted">{m.sharePercent}%</span>
                      </span>
                    ) : (
                      <span className="text-brand-faint">&ndash;</span>
                    )}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-3 text-xs text-brand-faint">
        {survivor
          ? "Green ring: won. Red ring: lost. No ring: still to play. A pick shows once its game has started; until then it is blank."
          : "Each number is how many picks that player got right that week, among the picks shown so far."}
      </p>
    </section>
  );
}
