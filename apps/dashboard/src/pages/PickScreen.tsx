import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  dayHeading,
  easternDayKey,
  formatKickoff,
  formatKickoffTime,
  type MeSummary,
  type PickSheet,
  type SheetGame,
  type SheetPick,
} from "@bbb/shared";
import { api, ApiError } from "../lib/api";
import { useApi } from "../lib/useApi";
import { useServerNow } from "../lib/useServerClock";
import { teamNickname } from "../lib/teams";
import { Countdown } from "../components/Countdown";
import { TeamCard, type TeamCardMark } from "../components/TeamCard";

const primary =
  "flex min-h-12 w-full items-center justify-center rounded-[12px] bg-brand-accent px-4 font-semibold text-brand-accent-ink hover:bg-brand-accent-hover disabled:opacity-40";
const secondary =
  "flex min-h-12 w-full items-center justify-center rounded-[12px] border border-brand-border px-4 font-semibold text-brand-text hover:border-brand-accent";

// ---------------------------------------------------------------------------------------
// Small pieces

function Page({ children, withBar = false }: { children: React.ReactNode; withBar?: boolean }) {
  return <div className={`mx-auto max-w-lg px-6 pt-4 ${withBar ? "pb-44" : "pb-6"}`}>{children}</div>;
}

function Footer() {
  return <p className="mt-8 text-xs text-brand-faint">Please drink responsibly.</p>;
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-sm text-brand-muted">{children}</p>;
}

function groupByDay(games: SheetGame[]) {
  const groups: { key: string; heading: string; games: SheetGame[] }[] = [];
  for (const game of games) {
    const key = easternDayKey(game.kickoffTime);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.games.push(game);
    else groups.push({ key, heading: dayHeading(game.kickoffTime), games: [game] });
  }
  return groups;
}

function GameList({
  games,
  renderGame,
  statusOf,
}: {
  games: SheetGame[];
  renderGame: (game: SheetGame) => React.ReactNode;
  /** A short status shown beside the kickoff time (per-game pools: "Started", "Final"). */
  statusOf?: (game: SheetGame) => string | null;
}) {
  return (
    <div className="mt-4 space-y-5">
      {groupByDay(games).map((group) => (
        <section key={group.key}>
          <h2 className="mb-2 text-sm font-semibold text-brand-muted">{group.heading}</h2>
          <ul className="space-y-3">
            {group.games.map((game) => (
              <li key={game.id} id={`game-${game.id}`}>
                <p className="mb-1 text-xs text-brand-faint">
                  {formatKickoffTime(game.kickoffTime)}
                  {statusOf?.(game) ? ` · ${statusOf(game)}` : ""}
                </p>
                {renderGame(game)}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Header({
  title,
  line,
  sheet,
  nowMs,
  onLocked,
}: {
  title: string;
  line: string;
  sheet: PickSheet;
  nowMs: number;
  onLocked: () => void;
}) {
  return (
    <>
      <h1 className="text-3xl font-semibold leading-tight text-brand-text">{title}</h1>
      <p className="mt-1 text-sm text-brand-muted">{line}</p>
      {sheet.lockTime && (
        <Countdown
          lockTime={sheet.lockTime}
          nowMs={nowMs}
          onLocked={onLocked}
          label={sheet.lockRule === "game" ? (sheet.state === "picked" ? "Your pick locks in" : "Next game locks in") : "Locks in"}
          className="mt-2 text-sm font-semibold text-brand-accent"
        />
      )}
      {sheet.lockRule === "game" && <p className="mt-1 text-xs text-brand-faint">Each game locks when it kicks off.</p>}
    </>
  );
}

const weekPicks = (sheet: PickSheet): SheetPick[] => sheet.picks.filter((p) => p.weekNumber === sheet.weekNumber);

/** In a per-game pool a game is locked once the server says so, or its kickoff has passed on the
 * server's clock. (A whole-week pool never shows these screens once the week has locked.) */
const gameIsLocked = (game: SheetGame, nowMs: number) => game.locked || nowMs >= Date.parse(game.kickoffTime);

/** What to show beside a game's time in a per-game pool. */
const gameStatus = (game: SheetGame, nowMs: number): string | null =>
  game.result !== "pending" ? "Final" : gameIsLocked(game, nowMs) ? "Started" : null;

/** The card mark for a team in a game that can no longer be picked. */
function lockedMark(pick: SheetPick | undefined): TeamCardMark {
  if (!pick) return { kind: "label", text: "Started", tone: "muted" };
  if (pick.result === "pending") return { kind: "label", text: "Your pick · locked", tone: "muted" };
  return { kind: "label", text: `Your pick · ${resultLabel(pick.result)}`, tone: pick.result === "win" ? "good" : "bad" };
}

const resultLabel = (r: SheetPick["result"]) =>
  r === "win" ? "Correct" : r === "loss" ? "Wrong" : r === "tie" ? "Tied" : "Waiting";

// ---------------------------------------------------------------------------------------
// States that are not "choosing"

function NotYours() {
  return (
    <Page>
      <h1 className="text-3xl font-semibold leading-tight text-brand-text">That isn't your entry</h1>
      <Note>You can only make picks for your own entry. Here's the way back to your pools.</Note>
      <Link to="/" className={`${primary} mt-6`}>
        Back to my pools
      </Link>
    </Page>
  );
}

function EliminatedView({ sheet }: { sheet: PickSheet }) {
  const { data: summary } = useApi<MeSummary>("/me/summary");
  const offer = sheet.poolType === "survivor" ? summary?.joinablePools.filter((p) => p.type === "pick_em") ?? [] : [];
  return (
    <Page>
      <h1 className="text-3xl font-semibold leading-tight text-brand-text">Your season</h1>
      <p className="mt-1 text-lg text-brand-text">Eliminated in week {sheet.eliminatedWeek ?? "?"}</p>
      <Note>You're out of this one. Picks are done for you, but you can keep following along.</Note>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-brand-muted">Your picks</h2>
      <ul className="divide-y divide-brand-border rounded-[14px] border border-brand-border bg-brand-surface">
        {sheet.picks.map((p) => (
          <li key={`${p.weekNumber}-${p.teamCode}`} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-brand-text">
              <span className="font-semibold">{p.teamCode}</span> {teamNickname(p.teamCode)}
              <span className="ml-2 text-brand-faint">Week {p.weekNumber}</span>
            </span>
            <span className={p.result === "win" ? "text-brand-success" : p.result === "pending" ? "text-brand-muted" : "text-brand-danger"}>
              {resultLabel(p.result)}
            </span>
          </li>
        ))}
        {sheet.picks.length === 0 && <li className="px-4 py-3 text-sm text-brand-muted">No picks were made.</li>}
      </ul>

      <Link to={`/pool/${sheet.poolId}`} className={`${primary} mt-6`}>
        See standings
      </Link>
      {offer.map((pool) => (
        <Link key={pool.id} to={`/join/${pool.id}`} className={`${secondary} mt-3`}>
          Join {pool.name}
        </Link>
      ))}
      <Footer />
    </Page>
  );
}

function EmptyView({ sheet }: { sheet: PickSheet }) {
  const over = sheet.state === "season_over";
  return (
    <Page>
      <h1 className="text-3xl font-semibold leading-tight text-brand-text">
        {over ? `${sheet.seasonYear} season complete` : "No games yet"}
      </h1>
      <Note>{over ? "Thanks for playing. See you next season." : "The schedule hasn't been added yet. Check back soon."}</Note>
      <Link to={`/pool/${sheet.poolId}`} className={`${primary} mt-6`}>
        {over ? "See final standings" : "See standings"}
      </Link>
      <Footer />
    </Page>
  );
}

function LockedView({ sheet }: { sheet: PickSheet }) {
  const mine = weekPicks(sheet);
  const isPickEm = sheet.poolType === "pick_em";
  const pickFor = (game: SheetGame) => mine.find((p) => p.teamCode === game.homeTeam || p.teamCode === game.awayTeam);
  const correct = mine.filter((p) => p.result === "win").length;

  return (
    <Page>
      <h1 className="text-3xl font-semibold leading-tight text-brand-text">Picks are locked</h1>
      {isPickEm ? (
        <>
          <p className="mt-1 text-sm text-brand-muted">
            {sheet.poolName} &middot; games are underway. Your picks are final for this week. Good luck!
          </p>
          <p className="mt-2 text-sm font-semibold text-brand-text">This week: {correct} correct so far</p>
        </>
      ) : (
        <p className="mt-1 text-sm text-brand-muted">
          {mine.length > 0
            ? `Your pick: ${mine.map((p) => `the ${teamNickname(p.teamCode)}`).join(" and the ")}. ${
                mine.length > 1 ? "If both win" : "If they win"
              }, you stay alive. Results are added as games finish.`
            : "Games are underway. Results are added as games finish."}
        </p>
      )}

      <GameList
        games={sheet.games}
        renderGame={(game) => {
          const pick = pickFor(game);
          const decided = game.result !== "pending";
          const markFor = (team: string): TeamCardMark => {
            if (pick?.teamCode !== team) return { kind: "none" };
            if (pick.result === "pending") return { kind: "label", text: "Your pick · Waiting", tone: "muted" };
            return {
              kind: "label",
              text: `Your pick · ${resultLabel(pick.result)}`,
              tone: pick.result === "win" ? "good" : "bad",
            };
          };
          return (
            <>
              <div className="flex gap-2">
                <TeamCard code={game.awayTeam} mark={markFor(game.awayTeam)} />
                <TeamCard code={game.homeTeam} mark={markFor(game.homeTeam)} />
              </div>
              <p className="mt-1 text-xs text-brand-faint">
                {decided ? "Final" : "Waiting for result"}
                {isPickEm && !pick ? " · No pick made" : ""}
              </p>
            </>
          );
        }}
      />
      <Note>
        {isPickEm
          ? "Results are added by the brewery as games finish, so they may take a little while to show up."
          : sheet.lockRule === "game"
            ? "Your pick is locked because its game has started."
            : "Picks can't be changed once the week's first game has started."}
      </Note>
      <Link to="/" className={`${secondary} mt-6`}>
        Back to Home
      </Link>
      <Footer />
    </Page>
  );
}

// ---------------------------------------------------------------------------------------
// Survivor: select, then lock in

function SurvivorPick({
  sheet,
  nowMs,
  reload,
  onLocked,
}: {
  sheet: PickSheet;
  nowMs: number;
  reload: () => Promise<void>;
  onLocked: () => void;
}) {
  const week = sheet.weekNumber!;
  const saved = weekPicks(sheet).map((p) => p.teamCode);
  const savedKey = saved.join(",");
  const limit = sheet.limit;
  const [selected, setSelected] = useState<string[]>(saved);
  const [editing, setEditing] = useState(saved.length < limit);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // What is saved on the server is the truth whenever the player is not mid-change. While
  // they are choosing (including after a save that only partly worked) their selection stays,
  // so they can simply try again.
  useEffect(() => {
    if (!editing) setSelected(savedKey ? savedKey.split(",") : []);
  }, [savedKey, editing]);

  const double = limit > 1;
  const perGame = sheet.lockRule === "game";
  const gameOf = (team: string) => sheet.games.find((g) => g.homeTeam === team || g.awayTeam === team);
  // A team whose game has started cannot be picked, changed or removed (per-game pools only).
  const teamLocked = (team: string) => {
    const g = gameOf(team);
    return perGame && g !== undefined && gameIsLocked(g, nowMs);
  };
  const statusOf = perGame ? (g: SheetGame) => gameStatus(g, nowMs) : undefined;
  const opponentOf = (team: string) => {
    const g = gameOf(team);
    return g ? (g.homeTeam === team ? g.awayTeam : g.homeTeam) : "";
  };

  function toggle(team: string) {
    setMessage(null);
    if (teamLocked(team)) return;
    setSelected((current) => {
      if (limit === 1) return [team];
      if (current.includes(team)) return teamLocked(team) ? current : current.filter((t) => t !== team);
      if (current.length >= limit) {
        // Make room by dropping the first pick that is still changeable.
        const drop = current.findIndex((t) => !teamLocked(t));
        return drop < 0 ? current : [...current.filter((_, i) => i !== drop), team];
      }
      return [...current, team];
    });
  }

  async function lockIn() {
    setBusy(true);
    setMessage(null);
    const post = (team: string) =>
      api(`/entries/${sheet.entryId}/picks`, { method: "POST", body: JSON.stringify({ week_number: week, team_code: team }) });
    try {
      if (limit === 1) {
        await post(selected[0]!);
      } else {
        for (const team of saved.filter((t) => !selected.includes(t))) {
          await api(`/entries/${sheet.entryId}/picks/${week}/${team}`, { method: "DELETE" });
        }
        for (const team of selected.filter((t) => !saved.includes(t))) await post(team);
      }
      await reload();
      setEditing(false);
    } catch (e) {
      await reload();
      setMessage(
        `${e instanceof ApiError ? e.message : "Something went wrong"}. Your pick was not fully saved, so check what's shown and try again.`
      );
    } finally {
      setBusy(false);
    }
  }

  const title = double ? `Week ${week} picks` : `Week ${week} pick`;
  const line = `${sheet.poolName} · pick ${double ? "two teams" : "one team"} to win`;

  // Saved and not being changed: the "Locked in" view.
  if (!editing && saved.length >= limit) {
    return (
      <Page>
        <Header title="Locked in" line={`${sheet.poolName} · Week ${week}`} sheet={sheet} nowMs={nowMs} onLocked={onLocked} />
        <p className="mt-3 text-lg text-brand-text">
          You picked {saved.map((t) => `the ${teamNickname(t)}`).join(" and ")}.
        </p>
        <p className="mt-1 text-sm text-brand-muted">
          {saved.length > 1 ? "If both win" : "If they win"}, you stay alive for week {week + 1}.
        </p>
        <GameList
          games={sheet.games}
          statusOf={statusOf}
          renderGame={(game) => (
            <div className="flex gap-2">
              {[game.awayTeam, game.homeTeam].map((team) => (
                <TeamCard
                  key={team}
                  code={team}
                  mark={
                    teamLocked(team)
                      ? lockedMark(saved.includes(team) ? weekPicks(sheet).find((p) => p.teamCode === team) : undefined)
                      : saved.includes(team)
                        ? { kind: "yourPick" }
                        : { kind: "none" }
                  }
                />
              ))}
            </div>
          )}
        />
        <div className="mt-6 space-y-3">
          {saved.some((t) => !teamLocked(t)) && (
            <button type="button" onClick={() => setEditing(true)} className={secondary}>
              Change my pick{double ? "s" : ""}
            </button>
          )}
          <Link to="/" className={secondary}>
            Back to Home
          </Link>
        </div>
        <Note>
          {perGame
            ? "You can change a pick until its game kicks off. Once it starts, that pick is locked."
            : "You can change your pick any time until the week's first game kicks off."}
        </Note>
        <Footer />
      </Page>
    );
  }

  const markFor = (team: string): TeamCardMark => {
    if (teamLocked(team)) return lockedMark(weekPicks(sheet).find((p) => p.teamCode === team));
    const usedWeek = sheet.usedTeams[team];
    if (usedWeek !== undefined && !sheet.allowRepeatTeams) return { kind: "used", week: usedWeek };
    return selected.includes(team) ? { kind: "selected" } : { kind: "none" };
  };

  const first = selected[0];
  const barText = !first
    ? ""
    : double
      ? selected.length < limit
        ? `${selected.length} of ${limit} picked. Pick one more team to lock in this week.`
        : `${selected.map((t) => teamNickname(t)).join(" and ")}. You can change these until kickoff.`
      : `${teamNickname(first)}, ${formatKickoff(gameOf(first)?.kickoffTime ?? "")} vs ${teamNickname(opponentOf(first))}. You can change this until kickoff.`;

  return (
    <Page withBar={selected.length > 0}>
      <Header title={title} line={line} sheet={sheet} nowMs={nowMs} onLocked={onLocked} />
      {double && (
        <div className="mt-3 rounded-[14px] border border-brand-border bg-brand-surface p-3 text-sm text-brand-muted">
          <p className="font-semibold text-brand-text">Double-pick week</p>
          <p>Choose two teams this week. If either one loses or ties, you're out.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {selected.map((t) => (
              <span key={t} className="rounded-full bg-brand-accent-soft px-3 py-1 text-sm font-semibold text-brand-text">
                {t} {teamNickname(t)}
              </span>
            ))}
            {selected.length < limit && (
              <span className="rounded-full border border-dashed border-brand-border px-3 py-1 text-sm">Choose another team</span>
            )}
          </div>
        </div>
      )}
      {!sheet.allowRepeatTeams && (
        <Note>Each team can only be used once all season. If your team loses or ties, you're out.</Note>
      )}
      {message && (
        <p role="alert" className="mt-3 text-sm text-brand-danger">
          {message}
        </p>
      )}

      <GameList
        games={sheet.games}
        statusOf={statusOf}
        renderGame={(game) => (
          <div className="flex gap-2">
            {[game.awayTeam, game.homeTeam].map((team) => (
              <TeamCard
                key={team}
                code={team}
                mark={markFor(team)}
                onSelect={teamLocked(team) ? undefined : () => toggle(team)}
                disabled={busy}
              />
            ))}
          </div>
        )}
      />

      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-[4.75rem] z-20 border-t border-brand-border bg-brand-bg/95 px-4 pb-3 pt-3 backdrop-blur">
          <div className="mx-auto max-w-lg">
            <p className="mb-2 text-sm text-brand-muted">{barText}</p>
            <button type="button" disabled={busy || selected.length < limit} onClick={lockIn} className={primary}>
              {double ? `Lock in ${limit} picks` : `Lock in ${teamNickname(first!)}`}
            </button>
          </div>
        </div>
      )}
      <Footer />
    </Page>
  );
}

// ---------------------------------------------------------------------------------------
// Pick 'em: tap to pick, saved as you tap

function PickEmPick({
  sheet,
  nowMs,
  reload,
  onLocked,
}: {
  sheet: PickSheet;
  nowMs: number;
  reload: () => Promise<void>;
  onLocked: () => void;
}) {
  const week = sheet.weekNumber!;
  const mine = weekPicks(sheet);
  // One request at a time per game, so a quick second tap cannot interleave a delete and a post.
  const [pending, setPending] = useState<Set<string>>(new Set());
  const inFlight = useRef<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  const perGame = sheet.lockRule === "game";
  const pickFor = (game: SheetGame) => mine.find((p) => p.teamCode === game.homeTeam || p.teamCode === game.awayTeam);
  const closed = (game: SheetGame) => perGame && gameIsLocked(game, nowMs);
  // Games that can still be picked and have no pick yet.
  const unpicked = sheet.games.filter((g) => !pickFor(g) && !closed(g));
  const total = sheet.games.length;
  const picked = sheet.games.filter((g) => pickFor(g)).length;

  const tap = useCallback(
    async (game: SheetGame, team: string) => {
      if (inFlight.current.has(game.id)) return;
      if (perGame && gameIsLocked(game, nowMs)) return;
      const current = mine.find((p) => p.teamCode === game.homeTeam || p.teamCode === game.awayTeam);
      if (current?.teamCode === team) return;
      inFlight.current.add(game.id);
      setPending(new Set(inFlight.current));
      setMessage(null);
      try {
        if (current) {
          await api(`/entries/${sheet.entryId}/picks/${week}/${current.teamCode}`, { method: "DELETE" });
        }
        await api(`/entries/${sheet.entryId}/picks`, {
          method: "POST",
          body: JSON.stringify({ week_number: week, team_code: team }),
        });
      } catch (e) {
        setMessage(`${e instanceof ApiError ? e.message : "Something went wrong"}. That pick was not saved.`);
      } finally {
        await reload();
        inFlight.current.delete(game.id);
        setPending(new Set(inFlight.current));
      }
    },
    [mine, reload, sheet.entryId, week, perGame, nowMs]
  );

  function jumpToNext() {
    const next = unpicked[0];
    if (next) document.getElementById(`game-${next.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <Page>
      <Header
        title={`Week ${week} picks`}
        line={`${sheet.poolName} · tap a team to pick the winner`}
        sheet={sheet}
        nowMs={nowMs}
        onLocked={onLocked}
      />
      <p className="mt-2 text-sm font-semibold text-brand-text">
        {picked} of {total} picked
      </p>

      {unpicked.length > 0 ? (
        <div className="mt-3 flex items-center justify-between rounded-[14px] border border-brand-border bg-brand-surface px-4 py-2">
          <span className="text-sm text-brand-muted">
            {unpicked.length} game{unpicked.length === 1 ? "" : "s"} left to pick
          </span>
          <button type="button" onClick={jumpToNext} className="min-h-11 text-sm font-semibold text-brand-accent">
            Jump to next
          </button>
        </div>
      ) : (
        <div className="mt-3 rounded-[14px] border border-brand-border bg-brand-surface p-4">
          <p className="font-semibold text-brand-text">All picks in</p>
          <p className="text-sm text-brand-muted">
            {perGame
              ? `You're all set for the games still to come in Week ${week}. You can change a pick until its game kicks off.`
              : `You're all set for Week ${week}. You can change any pick until the week's first game kicks off.`}
          </p>
        </div>
      )}
      {message && (
        <p role="alert" className="mt-3 text-sm text-brand-danger">
          {message}
        </p>
      )}

      <GameList
        games={sheet.games}
        statusOf={perGame ? (g) => gameStatus(g, nowMs) : undefined}
        renderGame={(game) => {
          const current = pickFor(game);
          const saving = pending.has(game.id);
          const isClosed = closed(game);
          return (
            <>
              <div className="flex gap-2">
                {[game.awayTeam, game.homeTeam].map((team) => (
                  <TeamCard
                    key={team}
                    code={team}
                    mark={
                      isClosed
                        ? current?.teamCode === team
                          ? lockedMark(current)
                          : { kind: "none" }
                        : current?.teamCode === team
                          ? { kind: "picked" }
                          : { kind: "none" }
                    }
                    onSelect={isClosed ? undefined : () => void tap(game, team)}
                    disabled={saving}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-brand-faint">
                {saving ? "Saving…" : isClosed ? (current ? "" : "No pick made") : current ? "" : "Pick a winner"}
              </p>
            </>
          );
        }}
      />
      <Note>
        {perGame
          ? "Your picks save as you tap. You can change a pick until its game kicks off."
          : "Your picks save as you tap. You can change them any time until the week's first game kicks off."}
      </Note>
      <Link to="/" className={`${secondary} mt-6`}>
        Back to Home
      </Link>
      <Footer />
    </Page>
  );
}

// ---------------------------------------------------------------------------------------

export function PickScreen() {
  const { entryId } = useParams();
  const { data: sheet, error, reload } = useApi<PickSheet>(`/entries/${entryId}/pick-sheet`);
  const nowMs = useServerNow(sheet?.serverNow);
  const onLocked = useCallback(() => void reload(), [reload]);

  if (error?.status === 403) return <NotYours />;
  if (error && !sheet) {
    return (
      <Page>
        <p className="text-sm text-brand-muted">
          {error.status === 404 ? "We couldn't find that entry." : error.message}
        </p>
        <Link to="/" className={`${secondary} mt-6`}>
          Back to Home
        </Link>
      </Page>
    );
  }
  if (!sheet) return null;

  if (sheet.state === "eliminated") return <EliminatedView sheet={sheet} />;
  if (sheet.state === "season_over" || sheet.state === "no_games" || sheet.weekNumber === null) {
    return <EmptyView sheet={sheet} />;
  }

  // A whole-week pool locks everything at the week's first kickoff. A per-game pool only shows the
  // locked view when nothing is left to pick or change (the server decides; each game's own clock
  // is handled inside the screens).
  const lockedByClock = sheet.lockRule === "week" && sheet.lockTime !== null && nowMs >= Date.parse(sheet.lockTime);
  if (sheet.state === "locked" || lockedByClock) return <LockedView sheet={sheet} />;

  return sheet.poolType === "pick_em" ? (
    <PickEmPick sheet={sheet} nowMs={nowMs} reload={reload} onLocked={onLocked} />
  ) : (
    <SurvivorPick sheet={sheet} nowMs={nowMs} reload={reload} onLocked={onLocked} />
  );
}
