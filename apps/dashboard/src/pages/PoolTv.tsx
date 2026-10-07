import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { formatRank, type PoolTv as PoolTvData, type TvStatus } from "@bbb/shared";
import { useApi } from "../lib/useApi";
import { teamNickname } from "../lib/teams";
import { TvLayout } from "../components/TvLayout";

const REFRESH_MS = 30_000;
const MAX_NAMES = 30;

const STATUS_TEXT: Record<TvStatus, string> = {
  open: "Picks open",
  locked: "Picks locked · games underway",
  season_over: "Season complete",
  no_games: "Waiting for the schedule",
};

function Qr({ url }: { url: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void import("qrcode").then(async (QR) => {
      const drawn = await QR.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
      if (!cancelled) setSvg(drawn);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return (
    <div
      role="img"
      aria-label="QR code to play on your phone"
      data-url={url}
      className="h-[84px] w-[84px] flex-none overflow-hidden rounded-[10px] bg-white [&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg ?? "" }}
    />
  );
}

/** The bar's TV: a signed-in page, survivor first, refreshed every 30 seconds. */
export function PoolTv() {
  const { poolId } = useParams();
  const { data, error, reload } = useApi<PoolTvData>(`/pools/${poolId}/tv`);

  useEffect(() => {
    const timer = window.setInterval(() => void reload(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [reload]);

  if (error && !data) {
    return (
      <TvLayout>
        <p className="col-span-2 grid place-items-center text-2xl text-brand-muted">
          {error.status === 404 ? "That pool wasn't found." : "Couldn't load the standings. Trying again."}
        </p>
      </TvLayout>
    );
  }
  if (!data) return <TvLayout>{null}</TvLayout>;

  const survivor = data.pool.type === "survivor";
  const week = data.weekNumber ? ` · Week ${data.weekNumber}` : "";
  const shown = data.alive.slice(0, MAX_NAMES);
  const hidden = data.alive.length - shown.length;

  return (
    <TvLayout>
      <section className="flex flex-col border-r border-brand-border px-11 pb-9 pt-11">
        <div className="flex items-center gap-3.5">
          <div aria-hidden="true" className="grid h-[52px] w-[52px] place-items-center rounded-[14px] bg-brand-accent text-[26px] font-bold text-brand-accent-ink">
            B
          </div>
          <div>
            <b className="block text-2xl font-semibold leading-tight">Brew Bowl</b>
            <small className="block text-[15px] text-brand-muted">Bancroft Brewing Co.</small>
          </div>
        </div>
        <p className="mt-[30px] text-xl text-brand-muted">
          {data.pool.name}
          {week}
        </p>
        <p data-testid="tv-count" className="mt-1 text-[132px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
          {survivor ? data.playersLeft : data.playersTotal}
        </p>
        <p className="mt-0.5 text-[30px] font-medium text-brand-muted">
          {survivor ? `of ${data.playersTotal} still alive` : "players"}
        </p>
        <p data-testid="tv-status" className="mt-[18px] self-start whitespace-nowrap rounded-full bg-brand-surface-raised px-4 py-2 text-lg font-medium text-brand-muted">
          {data.status === "locked" && data.pickDeadline === "per_game_kickoff"
            ? "Games underway · picks lock game by game"
            : STATUS_TEXT[data.status]}
        </p>
        {survivor && (
          <div className="mt-auto rounded-[18px] border border-brand-border bg-brand-surface px-5 py-4">
            <small className="text-[15px] text-brand-muted">Most picked this week</small>
            {data.mostPicked.length === 0 ? (
              <p className="mt-2 text-lg text-brand-muted">
                {data.revealPicks === "after_final_game" ? "Shown when the week's games are final" : "Shown once picks lock"}
              </p>
            ) : (
              data.mostPicked.map((m, i) => (
                <div
                  key={m.team}
                  data-testid="tv-most-picked"
                  className={`mt-2 flex items-center gap-3.5 font-semibold ${i === 0 ? "text-2xl" : "text-xl text-brand-muted"}`}
                >
                  <span className="w-[130px] flex-none truncate">{teamNickname(m.team)}</span>
                  <span className="h-3 flex-1 overflow-hidden rounded-full bg-brand-surface-raised">
                    <i className="block h-full rounded-full bg-brand-accent" style={{ width: `${m.sharePercent}%` }} />
                  </span>
                  <span className="w-14 text-right font-medium tabular-nums text-brand-muted">{m.sharePercent}%</span>
                </div>
              ))
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col px-11 pb-9 pt-11">
        {survivor ? (
          <>
            <h2 className="text-[26px] font-semibold">
              Still alive<span className="ml-2.5 font-medium text-brand-muted">{data.playersLeft}</span>
            </h2>
            <div data-testid="tv-names" className="mt-5 grid grid-cols-3 gap-x-7 gap-y-1 text-2xl">
              {shown.map((name, i) => (
                <div key={`${name}-${i}`} className="truncate border-b border-brand-border py-2">
                  {name}
                </div>
              ))}
              {hidden > 0 && <div className="py-2 text-brand-muted">and {hidden} more</div>}
            </div>
          </>
        ) : (
          <>
            <h2 className="text-[26px] font-semibold">Leaderboard</h2>
            <ol data-testid="tv-leaderboard" className="mt-5 text-2xl">
              {data.leaderboard.map((row, i) => (
                <li key={`${row.name}-${i}`} className="flex items-center gap-4 border-b border-brand-border py-2">
                  <span className="w-14 font-semibold tabular-nums text-brand-muted">{formatRank({ rank: row.rank, tied: row.tied })}</span>
                  <span className="flex-1 truncate">{row.name}</span>
                  <span className="font-semibold tabular-nums">
                    {row.points}
                    <small className="ml-1 text-base font-normal text-brand-muted">pts</small>
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
        <div className="mt-auto flex items-center gap-[22px] rounded-[18px] border border-brand-border bg-brand-surface px-[22px] py-4">
          <Qr url={window.location.origin} />
          <div>
            <b className="block text-2xl font-semibold">Play on your phone</b>
            <span className="mt-1 block text-[17px] text-brand-muted">Scan to sign in at {window.location.host}</span>
          </div>
        </div>
      </section>
    </TvLayout>
  );
}
