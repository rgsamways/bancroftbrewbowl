import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { formatRank, recapShareText, type PoolRecap as PoolRecapData } from "@bbb/shared";
import { useApi } from "../lib/useApi";
import { teamNickname } from "../lib/teams";

const primary =
  "flex min-h-12 w-full items-center justify-center rounded-[12px] bg-brand-accent px-4 font-semibold text-brand-accent-ink hover:bg-brand-accent-hover";
const secondary =
  "flex min-h-12 w-full items-center justify-center rounded-[12px] border border-brand-border px-4 font-semibold text-brand-text hover:border-brand-accent";

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-[12px] bg-brand-surface-raised px-3.5 py-3">
      <small className="block text-xs text-brand-muted">{label}</small>
      <b className="mt-0.5 block text-2xl font-semibold tabular-nums">
        {value}
        {note && <span className="ml-1 text-sm font-medium text-brand-muted">{note}</span>}
      </b>
    </div>
  );
}

/** The weekly recap for one pool: how the week went and how the player did. */
export function PoolRecap() {
  const { poolId } = useParams();
  const [params] = useSearchParams();
  const week = params.get("week");
  const { data, error } = useApi<PoolRecapData>(`/pools/${poolId}/recap${week ? `?week=${encodeURIComponent(week)}` : ""}`);
  const [copied, setCopied] = useState(false);

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-6 pb-6 pt-6">
        <section className="rounded-[20px] border border-brand-border bg-brand-surface p-5">
          <h1 className="text-2xl font-semibold text-brand-text">No recap yet</h1>
          <p className="mt-2 text-sm text-brand-muted">A recap shows up once every game of a week with picks has a result.</p>
          <Link to="/" className={`${secondary} mt-4`}>
            Back to Home
          </Link>
        </section>
      </div>
    );
  }
  if (!data) return null;

  const survivor = data.pool.type === "survivor";
  const you = data.you;
  const share = async () => {
    const text = recapShareText(data, window.location.origin);
    if (navigator.share) {
      try {
        await navigator.share({ title: `${data.pool.name} week ${data.week} recap`, text });
      } catch {
        // The share sheet was closed; nothing to do.
      }
      return;
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  const myPick = you?.picks.map((p) => `${teamNickname(p.team)}`).join(" and ");
  const myResult = you?.picks.every((p) => p.result === "win")
    ? "won"
    : you?.picks.some((p) => p.result === "loss")
      ? "lost"
      : "tied";

  return (
    <div className="mx-auto max-w-lg px-6 pb-6 pt-4">
      <h1 className="text-2xl font-semibold text-brand-text">Week {data.week} recap</h1>
      <p className="mb-4 mt-1 text-sm text-brand-muted">{data.pool.name}</p>

      <section className="rounded-[20px] border border-brand-border bg-brand-surface p-5">
        {survivor ? (
          <>
            {you && (
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                  you.survived ? "bg-brand-success/10 text-brand-success" : "bg-brand-surface-raised text-brand-muted"
                }`}
              >
                {you.survived ? "You survived" : "You're out"}
              </span>
            )}
            <h2 data-testid="recap-headline" className="mb-1 mt-3.5 text-[28px] font-semibold leading-tight">
              {you?.survived === false ? `Out in week ${data.week}` : `Still alive after week ${data.week}`}
            </h2>
            <p className="text-sm text-brand-muted">
              {data.playersLeft} of {data.playersTotal} players left
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <Stat label="Players out this week" value={String(data.playersOut ?? 0)} />
              <Stat
                label="Most picked"
                value={data.mostPicked ? teamNickname(data.mostPicked.team) : "None"}
                note={data.mostPicked ? `${data.mostPicked.sharePercent}%` : undefined}
              />
              <Stat
                label="Biggest upset"
                value={data.upset ? teamNickname(data.upset.winner) : "None"}
                note={data.upset ? `over ${teamNickname(data.upset.loser)}` : undefined}
              />
              {you && you.picks.length > 0 && <Stat label="Your pick" value={myPick ?? ""} note={myResult} />}
            </div>
          </>
        ) : (
          <>
            <h2 data-testid="recap-headline" className="mb-1 text-[28px] font-semibold leading-tight">
              {you ? `${you.correct} of ${you.gamesTotal} right` : `Week ${data.week} is in the books`}
            </h2>
            <p className="text-sm text-brand-muted">{data.playersTotal} players</p>
            {you && (
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <Stat label="Your points" value={String(you.points ?? 0)} />
                <Stat label="Your rank" value={you.rank !== null ? formatRank({ rank: you.rank, tied: you.tied }) : "-"} />
                <Stat label="Leader" value={String(data.leaderPoints ?? 0)} note="pts" />
              </div>
            )}
          </>
        )}
      </section>

      <div className="mt-4 space-y-2.5">
        {you && (
          <button type="button" onClick={() => void share()} className={primary}>
            {copied ? "Copied to share" : "Share my recap"}
          </button>
        )}
        <Link to="/" className={secondary}>
          Back to Home
        </Link>
      </div>
      <p className="mt-6 text-xs text-brand-faint">Please drink responsibly.</p>
    </div>
  );
}
