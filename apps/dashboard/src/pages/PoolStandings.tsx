import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import {
  formatRank,
  initials,
  type MeSummary,
  type PoolStandings as PoolStandingsData,
  type StandingsRow,
} from "@bbb/shared";
import { useApi } from "../lib/useApi";
import { InviteButton } from "../components/InviteButton";
import { PoolTotalCard } from "../components/PoolTotalCard";
import { PickGridView } from "../components/PickGridView";

const ALIVE_SHORT = 8;
const ELIMINATED_SHORT = 5;
const LEADERBOARD_SHORT = 8;

const cardClass = "mb-4 rounded-[14px] border border-brand-border bg-brand-surface p-4";

function Avatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid h-9 w-9 flex-none place-items-center rounded-full border border-brand-border bg-brand-surface-raised text-xs font-semibold text-brand-text"
    >
      {initials(name)}
    </span>
  );
}

function Row({
  row,
  poolId,
  lead,
  trail,
}: {
  row: StandingsRow;
  poolId: string;
  lead?: string;
  trail?: string;
}) {
  const content = (
    <>
      {lead !== undefined && <span className="w-8 flex-none text-sm font-semibold text-brand-muted">{lead}</span>}
      <Avatar name={row.name} />
      <span className="min-w-0 flex-1 truncate text-brand-text">{row.name}</span>
      {row.isYou && (
        <span className="rounded-full bg-brand-accent-soft px-2 py-0.5 text-xs font-semibold text-brand-accent">You</span>
      )}
      {trail && <span className="flex-none text-sm text-brand-muted">{trail}</span>}
    </>
  );
  const base = "flex min-h-12 items-center gap-3 px-4 py-2";
  // Only your own row leads anywhere: the server would refuse anyone else's pick screen.
  return (
    <li className="border-b border-brand-border last:border-b-0">
      {row.isYou ? (
        <Link to={`/pool/${poolId}/entry/${row.entryId}/pick`} className={`${base} hover:bg-brand-surface-raised`}>
          {content}
        </Link>
      ) : (
        <div className={base}>{content}</div>
      )}
    </li>
  );
}

function RowList({
  rows,
  short,
  searching,
  render,
  empty = "Nobody yet",
}: {
  rows: StandingsRow[];
  short: number;
  searching: boolean;
  render: (row: StandingsRow) => React.ReactNode;
  empty?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const visible = searching || showAll ? rows : rows.slice(0, short);
  return (
    <>
      <ul className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
        {visible.map(render)}
        {rows.length === 0 && <li className="px-4 py-3 text-sm text-brand-muted">{empty}</li>}
      </ul>
      {!searching && !showAll && rows.length > short && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 flex min-h-11 w-full items-center justify-center rounded-[12px] border border-brand-border text-sm font-semibold text-brand-text hover:border-brand-accent"
        >
          Show all {rows.length}
        </button>
      )}
    </>
  );
}

function SurvivorSummary({ data }: { data: PoolStandingsData }) {
  const aliveCount = data.alive.length;
  const out = data.eliminated.length;
  const headline = data.me ? (data.me.status === "alive" ? "You're still alive" : "You're out") : data.pool.name;
  const week = data.seasonOver ? "Final" : data.lastDecidedWeek ? `After week ${data.lastDecidedWeek}` : "Before week 1";
  return (
    <section className={cardClass}>
      <p className="mb-1 text-sm text-brand-muted">{data.pool.name}</p>
      <h1 className="text-3xl font-semibold leading-tight text-brand-text">{headline}</h1>
      <p className="mt-1 text-lg text-brand-text">
        {aliveCount} of {data.playersTotal} still alive
      </p>
      <p className="mt-1 text-sm text-brand-muted">
        {week} &middot; {out} {out === 1 ? "player" : "players"} out so far
      </p>
    </section>
  );
}

function PickEmSummary({ data }: { data: PoolStandingsData }) {
  const me = data.me;
  if (!me || me.rank === undefined) {
    return (
      <section className={cardClass}>
        <h1 className="text-3xl font-semibold leading-tight text-brand-text">{data.pool.name}</h1>
        <p className="mt-1 text-sm text-brand-muted">{data.playersTotal} players</p>
      </section>
    );
  }
  const tied = Boolean(me.tied);
  const ordinal = formatRank({ rank: me.rank, tied: false }, "ordinal");
  const behind = (data.leaderPoints ?? 0) - (me.points ?? 0);
  return (
    <section className={cardClass}>
      <p className="mb-1 text-sm text-brand-muted">{data.pool.name}</p>
      <h1 className="text-3xl font-semibold leading-tight text-brand-text">{formatRank({ rank: me.rank, tied })}</h1>
      <p className="mt-1 text-lg text-brand-text">
        {tied ? `tied for ${ordinal}` : ordinal} of {data.playersTotal} players
      </p>
      <p className="mt-1 text-sm text-brand-muted">
        {me.points ?? 0} {(me.points ?? 0) === 1 ? "point" : "points"} &middot; {behind > 0 ? `${behind} behind the leader` : "Leading the pool"}
      </p>
    </section>
  );
}

export function PoolStandings() {
  const { poolId = "" } = useParams();
  const { data, error } = useApi<PoolStandingsData>(`/pools/${poolId}/standings`);
  const { data: summary } = useApi<MeSummary>("/me/summary");
  const [query, setQuery] = useState("");
  const [params, setParams] = useSearchParams();
  const weeksView = params.get("view") === "weeks";
  const chooseView = (view: "standings" | "weeks") => setParams(view === "weeks" ? { view: "weeks" } : {}, { replace: true });

  if (error && !data) {
    return (
      <p className="px-6 pt-6 text-sm text-brand-muted">
        {error.status === 404 ? "We couldn't find that pool." : "We couldn't load the standings. Check your connection and try again."}
      </p>
    );
  }
  if (!data) return null;

  const needle = query.trim().toLowerCase();
  const searching = needle.length > 0;
  const matches = (rows: StandingsRow[]) => (searching ? rows.filter((r) => r.name.toLowerCase().includes(needle)) : rows);
  const alive = matches(data.alive);
  const eliminated = matches(data.eliminated);
  const leaderboard = matches(data.leaderboard);
  const nothingFound =
    searching && (data.pool.type === "survivor" ? alive.length + eliminated.length === 0 : leaderboard.length === 0);

  const boardHeading = data.seasonOver
    ? "Final standings"
    : data.lastDecidedWeek
      ? `Leaderboard after week ${data.lastDecidedWeek}`
      : "Leaderboard";

  return (
    <div className="mx-auto max-w-lg px-6 pb-6 pt-4">
      {data.pool.type === "survivor" ? <SurvivorSummary data={data} /> : <PickEmSummary data={data} />}
      <PoolTotalCard cents={data.pool.poolTotalCents} />
      {!data.seasonOver && summary?.entries.some((e) => e.poolId === poolId) && (
        <div className="mb-5">
          <InviteButton poolId={poolId} poolName={data.pool.name} />
        </div>
      )}

      <div role="group" aria-label="View" className="mb-5 grid grid-cols-2 gap-1.5 rounded-[12px] border border-brand-border bg-brand-surface p-1">
        {([["standings", "Standings"], ["weeks", "Week by week"]] as const).map(([key, label]) => {
          const on = (key === "weeks") === weeksView;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => chooseView(key)}
              className={`min-h-11 rounded-[9px] text-sm font-semibold ${on ? "bg-brand-accent-soft text-brand-text" : "text-brand-muted"}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {weeksView ? (
        <PickGridView poolId={poolId} />
      ) : (
        <>

      <label className="mb-1 block text-sm font-semibold text-brand-muted" htmlFor="find-player">
        Find a player
      </label>
      <input
        id="find-player"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Type a name"
        autoComplete="off"
        className="mb-5 min-h-11 w-full rounded-[12px] border border-brand-border bg-brand-surface px-3 text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
      />
      {nothingFound && <p className="mb-4 text-sm text-brand-muted">No players match</p>}

      {data.pool.type === "survivor" ? (
        <>
          {!(searching && alive.length === 0) && (
            <section className="mb-6">
              <h2 className="mb-2 text-sm font-semibold text-brand-success">Still alive {alive.length}</h2>
              <RowList
                rows={alive}
                short={ALIVE_SHORT}
                searching={searching}
                render={(row) => <Row key={row.entryId} row={row} poolId={poolId} />}
              />
            </section>
          )}
          {!(searching && eliminated.length === 0) && (
            <section className="mb-6">
              <h2 className="mb-2 text-sm font-semibold text-brand-muted">Eliminated {eliminated.length}</h2>
              <RowList
                rows={eliminated}
                short={ELIMINATED_SHORT}
                searching={searching}
                render={(row) => <Row key={row.entryId} row={row} poolId={poolId} trail={`Out in week ${row.eliminatedWeek ?? "?"}`} />}
              />
            </section>
          )}
        </>
      ) : (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-brand-muted">{boardHeading}</h2>
          <RowList
            rows={leaderboard}
            short={LEADERBOARD_SHORT}
            searching={searching}
            empty="Nobody yet"
            render={(row) => (
              <Row
                key={row.entryId}
                row={row}
                poolId={poolId}
                lead={row.rank !== undefined ? formatRank({ rank: row.rank, tied: Boolean(row.tied) }) : ""}
                trail={`${row.points ?? 0} pts`}
              />
            )}
          />
          <p className="mt-3 text-xs text-brand-faint">Points update as the brewery adds game results.</p>
        </section>
      )}
        </>
      )}
      <Link to={`/pool/${poolId}/tv`} className="mb-4 flex min-h-11 items-center text-sm font-semibold text-brand-accent">
        Show on TV
      </Link>
      <p className="text-xs text-brand-faint">Please drink responsibly.</p>
    </div>
  );
}
