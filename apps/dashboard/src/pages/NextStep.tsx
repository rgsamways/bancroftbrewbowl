import { Link } from "react-router";
import { Check, ChevronRight } from "lucide-react";
import { formatKickoff, type AdminSummary } from "@bbb/shared";
import { api } from "../lib/api";
import { useApi } from "../lib/useApi";
import { teamNickname } from "../lib/teams";

const buttonClass =
  "mt-4 flex min-h-12 w-full items-center justify-center rounded-[12px] bg-brand-accent px-4 font-semibold text-brand-accent-ink hover:bg-brand-accent-hover";

const matchup = (g: { homeTeam: string; awayTeam: string }) => `${teamNickname(g.awayTeam)} vs ${teamNickname(g.homeTeam)}`;

function list(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function StepCard({ summary, onDismissed }: { summary: AdminSummary; onDismissed: () => void }) {
  const next = summary.next;

  if (next.kind === "confirm") {
    const r = next.request;
    return (
      <section className="rounded-[20px] border border-amber-500/50 bg-brand-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">Needs your confirmation</p>
        <h2 className="mt-1 text-2xl font-semibold leading-tight text-brand-text">Confirm a decision from {r.requestedByName}</h2>
        <p className="mt-2 text-sm text-brand-muted">
          {r.kind === "wipeout_resolution"
            ? `They chose who stays alive after a wipeout in ${r.poolName}, and their own name is on the list.`
            : `They want to change their own status in ${r.poolName}.`}{" "}
          It needs a second admin.
        </p>
        <Link to={`/admin/requests/${r.id}`} className={buttonClass}>
          Start
        </Link>
      </section>
    );
  }

  if (next.kind === "declined") {
    const r = next.request;
    return (
      <section className="rounded-[20px] border border-amber-500/50 bg-brand-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">Needs another look</p>
        <h2 className="mt-1 text-2xl font-semibold leading-tight text-brand-text">
          {r.decidedByName ?? "Another admin"} didn't confirm your decision
        </h2>
        {r.declineReason && <p className="mt-2 text-sm text-brand-muted">Reason: "{r.declineReason}"</p>}
        <p className="mt-2 text-sm text-brand-muted">
          Nothing has changed in {r.poolName}
          {r.kind === "wipeout_resolution" ? ", so the wipeout is still waiting for a decision." : "."}
        </p>
        <Link
          to={r.kind === "wipeout_resolution" && r.wipeoutId ? `/admin/wipeout/${r.poolId}/${r.wipeoutId}` : `/admin/pools/${r.poolId}?tab=players`}
          className={buttonClass}
        >
          Review and choose again
        </Link>
        <button
          type="button"
          onClick={() => void api(`/admin/requests/${r.id}/seen`, { method: "POST" }).then(onDismissed)}
          className="mt-2 flex min-h-12 w-full items-center justify-center rounded-[12px] border border-brand-border px-4 font-semibold text-brand-text hover:border-brand-accent"
        >
          Got it
        </button>
      </section>
    );
  }

  if (next.kind === "wipeout") {
    const w = next.wipeout;
    return (
      <section className="rounded-[20px] border border-amber-500/50 bg-brand-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">Needs your attention</p>
        <h2 className="mt-1 text-2xl font-semibold leading-tight text-brand-text">Everyone would be out</h2>
        <p className="mt-2 text-sm text-brand-muted">
          {w.poolName}: the result in {w.game ? matchup(w.game) : "a game"} would knock out all {w.candidates} players still
          alive. Nothing has been applied yet. Choose who stays in.
        </p>
        <Link to={`/admin/wipeout/${w.poolId}/${w.wipeoutId}`} className={buttonClass}>
          Resolve it
        </Link>
      </section>
    );
  }

  if (next.kind === "results") {
    const n = next.waiting.length;
    return (
      <section className="rounded-[20px] border border-brand-border bg-brand-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-accent">Your next step</p>
        <h2 className="mt-1 text-2xl font-semibold leading-tight text-brand-text">
          Enter the {n === 1 ? "result" : `${n} results`} still waiting
        </h2>
        <p className="mt-2 text-sm text-brand-muted">
          {list(next.waiting.slice(0, 3).map(matchup))}
          {n > 3 ? ` and ${n - 3} more` : ""}. It takes about a minute.
        </p>
        <Link to="/admin/results/steps" className={buttonClass}>
          Start
        </Link>
      </section>
    );
  }

  const [title, text] =
    next.kind === "no_schedule"
      ? ["No schedule yet", "There are no games loaded, so there's nothing to enter results for. The schedule is loaded once a season by the developer."]
      : next.kind === "season_complete"
        ? ["Season complete", `Every game of the ${summary.seasonYear} season has a result.`]
        : ["All done for now", "Nothing needs you. Results are in and standings are up to date."];
  return (
    <section className="rounded-[20px] border border-brand-border bg-brand-surface p-5">
      <h2 className="text-2xl font-semibold leading-tight text-brand-text">{title}</h2>
      <p className="mt-2 text-sm text-brand-muted">{text}</p>
    </section>
  );
}

function Row({ to, done, title, detail }: { to?: string; done?: boolean; title: string; detail: string }) {
  const body = (
    <>
      <span
        aria-hidden="true"
        className={`grid h-7 w-7 flex-none place-items-center rounded-full ${
          done ? "bg-brand-accent-soft text-brand-accent" : "border border-brand-border text-brand-faint"
        }`}
      >
        {done && <Check className="h-4 w-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-brand-text">{title}</span>
        <span className="block text-sm text-brand-muted">{detail}</span>
      </span>
      {to && <ChevronRight className="h-4 w-4 flex-none text-brand-faint" aria-hidden="true" />}
    </>
  );
  const cls = "flex min-h-14 items-center gap-3 px-4 py-2";
  return (
    <li className="border-b border-brand-border last:border-b-0">
      {to ? (
        <Link to={to} className={`${cls} hover:bg-brand-surface-raised`}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}

export function NextStep() {
  const { data: summary, error, reload } = useApi<AdminSummary>("/admin/summary");

  if (error && !summary) {
    return <p className="px-6 pt-6 text-sm text-brand-muted">We couldn't load your steps. Check your connection and try again.</p>;
  }
  if (!summary) return null;

  const hasWeek = summary.scheduleLoaded && summary.weekNumber !== null;
  return (
    <div className="mx-auto max-w-lg space-y-6 px-6 pb-6 pt-4">
      <div>
        <h1 className="text-3xl font-semibold leading-tight text-brand-text">Hi there</h1>
        <p className="mt-1 text-sm text-brand-muted">
          {hasWeek ? `Week ${summary.weekNumber} · here's what to do next.` : "Here's what to do next."}
        </p>
      </div>

      <StepCard summary={summary} onDismissed={() => void reload()} />

      {summary.requests.waiting.length > 0 && (
        <p role="status" className="rounded-[14px] border border-brand-border bg-brand-surface p-4 text-sm text-brand-muted">
          <strong className="text-brand-text">Waiting for another admin.</strong> {summary.requests.waiting[0]!.askedAdmins.join(", ")}{" "}
          can confirm your decision in {summary.requests.waiting[0]!.poolName}. Nothing changes until they do.
        </p>
      )}

      {(hasWeek || summary.pools.length > 0) && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-brand-muted">
            {hasWeek ? "Your week" : `${summary.seasonYear ?? ""} season`.trim()}
          </h2>
          <ul className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
            {hasWeek && (
              <>
                <Row done title="Schedule loaded" detail={`${summary.weekGamesTotal} games in week ${summary.weekNumber}`} />
                <Row
                  done={summary.locked}
                  title={summary.locked ? "Picks locked" : "Picks open"}
                  detail={
                    summary.lockTime
                      ? `${summary.locked ? "Locked at" : "Lock at"} ${formatKickoff(summary.lockTime)}`
                      : "No kickoff yet"
                  }
                />
                <Row
                  to="/admin/results"
                  done={summary.weekGamesEntered === summary.weekGamesTotal}
                  title="Results"
                  detail={`${summary.weekGamesEntered} of ${summary.weekGamesTotal} entered`}
                />
              </>
            )}
            {summary.pools.map((pool) => (
              <Row
                key={pool.id}
                to={`/admin/pools/${pool.id}`}
                done
                title={pool.name}
                detail={pool.type === "survivor" ? `${pool.alive} alive of ${pool.total}` : `${pool.total} players`}
              />
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-brand-muted">Everything else</h2>
        <Link
          to="/admin/more"
          className="flex min-h-12 items-center justify-between rounded-[14px] border border-brand-border bg-brand-surface px-4 text-brand-text hover:border-brand-accent"
        >
          All admin tools
          <ChevronRight className="h-4 w-4 text-brand-faint" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
