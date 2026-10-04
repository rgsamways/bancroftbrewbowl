import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import {
  formatEventDay,
  formatEventTime,
  formatMenuPrice,
  formatRank,
  SPECIAL_TAG_TEXT,
  STANDARD_ANNOUNCEMENT,
  styleLine,
  type BreweryHome,
  type JoinablePool,
  type MeSummary,
  type SummaryEntry,
} from "@bbb/shared";
import { useSession } from "../lib/auth-client";
import { useApi } from "../lib/useApi";
import { useServerNow } from "../lib/useServerClock";
import { attentionOrder, pickPathFor } from "../lib/attention";
import { Countdown } from "../components/Countdown";
import { PoolChips } from "../components/PoolChips";
import { InstallCard } from "../components/InstallCard";

const SELECTED_KEY = "bbb:home-pool";

const primaryLink =
  "mt-5 flex min-h-12 w-full items-center justify-center rounded-[12px] bg-brand-accent px-4 font-semibold text-brand-accent-ink hover:bg-brand-accent-hover";
const secondaryLink =
  "mt-5 flex min-h-12 w-full items-center justify-center rounded-[12px] border border-brand-border px-4 font-semibold text-brand-text hover:border-brand-accent";

function poolBlurb(type: JoinablePool["type"]) {
  return type === "pick_em"
    ? "Pick the winner of every game each week. Every correct pick scores a point, and the most points wins."
    : "Pick one team to win each week, and you can only use each team once. If your team loses, you're out. Last one standing wins.";
}

function Footer() {
  return <p className="mt-8 text-xs text-brand-faint">Please drink responsibly.</p>;
}

/** What is happening at the brewery: the featured item, specials on today, and the announcement
 * (or the standard message). Anything that does not apply is left out. */
function AtTheBrewery({ brewery }: { brewery: BreweryHome }) {
  const note = brewery.announcement ?? STANDARD_ANNOUNCEMENT;
  const featured = brewery.featured;
  const price = featured ? formatMenuPrice(featured.priceCents) : null;
  const card = "rounded-[14px] border border-brand-border bg-brand-surface p-4";
  return (
    <section aria-label="At the brewery">
      <h2 className="mb-2 text-sm font-semibold text-brand-muted">At the brewery</h2>
      <ul className="space-y-3">
        {brewery.live && (
          <li className={card}>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-accent">Live this weekend</p>
            <p className="mt-1 font-semibold text-brand-text">{brewery.live.title}</p>
            <p className="text-sm text-brand-muted">
              {formatEventDay(brewery.live.date)}, {formatEventTime(brewery.live.startTime, brewery.live.endTime)}
            </p>
            <Link to="/menu/music" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand-accent">
              See the music
            </Link>
          </li>
        )}
        {featured && (
          <li className={card}>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-accent">Featured</p>
            <p className="mt-1 font-semibold text-brand-text">
              {featured.name}
              {price && <span className="ml-2 font-normal text-brand-muted">{price}</span>}
            </p>
            {styleLine(featured) && <p className="text-sm text-brand-muted">{styleLine(featured)}</p>}
            <Link to={featured.kind === "dish" ? "/menu/kitchen" : "/menu"} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand-accent">
              See the menu
            </Link>
          </li>
        )}
        {brewery.specials.map((sp) => (
          <li key={sp.id} className={card}>
            {sp.tag && <p className="text-xs font-semibold uppercase tracking-wide text-brand-accent">{SPECIAL_TAG_TEXT[sp.tag]}</p>}
            <p className="mt-1 font-semibold text-brand-text">{sp.title}</p>
            {sp.details && <p className="text-sm text-brand-muted">{sp.details}</p>}
            <p className="text-sm text-brand-muted">{sp.when}</p>
          </li>
        ))}
        <li className={card}>
          <p className="font-semibold text-brand-text">{note.title}</p>
          <p className="mt-1 text-sm text-brand-muted">{note.message}</p>
        </li>
      </ul>
    </section>
  );
}

type Described = {
  title: string;
  sub: string;
  lines: string[];
  countdown: boolean;
  button: { label: string; to: string; primary: boolean };
};

/** The headline, sub-line, stat lines and button for one entry's current state. */
function describe(e: SummaryEntry): Described {
  const week = e.weekNumber;
  const standingsTo = `/pool/${e.poolId}`;
  const pickTo = pickPathFor(e);
  const standings = (label: string) => ({ label, to: standingsTo, primary: false });

  if (e.poolType === "survivor") {
    const line =
      e.playersLeft !== null && e.playersLeft < e.playersTotal
        ? `${e.poolName} · ${e.playersLeft} of ${e.playersTotal} players left`
        : `${e.poolName} · ${e.playersTotal} player${e.playersTotal === 1 ? "" : "s"}`;
    switch (e.state) {
      case "needs_picks":
        return { title: "You're still alive", sub: `Week ${week}: make your pick`, lines: [line], countdown: true, button: { label: "Make my pick", to: pickTo, primary: true } };
      case "picked":
        return { title: "Locked in", sub: `Week ${week}: you're all set`, lines: [line], countdown: true, button: { label: "Change my pick", to: pickTo, primary: false } };
      case "locked":
        return { title: "Picks are locked", sub: "Games are underway", lines: [line], countdown: false, button: standings("See standings") };
      case "eliminated":
        return { title: "You're out", sub: "Thanks for playing", lines: [`${e.poolName} · you went out in week ${e.eliminatedWeek ?? "?"}`], countdown: false, button: standings("See standings") };
      case "season_over":
        return {
          title: `${e.seasonYear} season complete`,
          sub: "That's a wrap",
          lines: ["Thanks for playing. See you next season.", ...(e.champion ? [`${e.poolName} champion: ${e.champion}`] : [])],
          countdown: false,
          button: standings("See final standings"),
        };
      default:
        return { title: "No games yet", sub: "Check back soon", lines: [line, "The schedule hasn't been added yet."], countdown: false, button: standings("See standings") };
    }
  }

  // Pick 'em
  const rank = e.rank !== null ? { rank: e.rank, tied: e.tied } : null;
  const rankPhrase = rank ? `${formatRank(rank, "ordinal")} of ${e.playersTotal}` : `${e.playersTotal} players`;
  const pointsLine = `${e.points ?? 0} points${rank ? ` · ${rank.tied ? "tied " : ""}${formatRank({ ...rank, tied: false }, "ordinal")} of ${e.playersTotal}` : ""}`;
  const progress = `${e.picksMade} of ${e.gamesTotal ?? e.picksNeeded} picked`;
  switch (e.state) {
    case "needs_picks":
      return {
        title: rankPhrase,
        sub: `Week ${week}: make your picks`,
        lines: [e.poolName, `Your points ${e.points ?? 0}`, rank ? `Rank ${formatRank(rank)} of ${e.playersTotal}` : "", progress].filter(Boolean),
        countdown: true,
        button: { label: e.picksMade > 0 ? "Finish my picks" : "Make my picks", to: pickTo, primary: true },
      };
    case "picked":
      return { title: "All picks in", sub: `Week ${week}: you're all set`, lines: [e.poolName, pointsLine, progress], countdown: true, button: { label: "Review or change my picks", to: pickTo, primary: false } };
    case "locked":
      return {
        title: "Picks are locked",
        sub: "Games are underway",
        lines: [e.poolName, `Your points ${e.points ?? 0}`, `This week: ${e.correctThisWeek ?? 0} correct so far`],
        countdown: false,
        button: { label: "See my picks", to: pickTo, primary: false },
      };
    case "season_over":
      return {
        title: `${e.seasonYear} season complete`,
        sub: "That's a wrap",
        lines: ["Thanks for playing. See you next season.", ...(e.champion ? [`${e.poolName} winner: ${e.champion}`] : [])],
        countdown: false,
        button: standings("See final standings"),
      };
    default:
      return { title: "No games yet", sub: "Check back soon", lines: [e.poolName, "The schedule hasn't been added yet."], countdown: false, button: standings("See standings") };
  }
}

function Hero({ entry, nowMs, onLocked }: { entry: SummaryEntry; nowMs: number; onLocked: () => void }) {
  const d = describe(entry);
  return (
    <section className="rounded-[20px] border border-brand-border bg-brand-surface p-5">
      <h1 className="text-3xl font-semibold leading-tight text-brand-text">{d.title}</h1>
      <p className="mt-1 text-lg text-brand-text">{d.sub}</p>
      <div className="mt-3 space-y-1 text-sm text-brand-muted">
        {d.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      {d.countdown && entry.lockTime && (
        <Countdown lockTime={entry.lockTime} nowMs={nowMs} onLocked={onLocked} className="mt-3 text-sm font-semibold text-brand-accent" />
      )}
      <Link to={d.button.to} className={d.button.primary ? primaryLink : secondaryLink}>
        {d.button.label}
      </Link>
    </section>
  );
}

function JoinCards({ pools, heading }: { pools: JoinablePool[]; heading: string }) {
  if (pools.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-semibold text-brand-muted">{heading}</h2>
      <ul className="space-y-3">
        {pools.map((pool) => (
          <li key={pool.id} className="rounded-[14px] border border-brand-border bg-brand-surface p-4">
            <p className="font-semibold text-brand-text">{pool.name}</p>
            <p className="text-xs text-brand-muted">
              {pool.type === "pick_em" ? "Pick 'em" : "Survivor"} &middot; {pool.seasonYear} season
            </p>
            <p className="mt-2 text-sm text-brand-muted">{poolBlurb(pool.type)}</p>
            <Link to={`/join/${pool.id}`} className={`${secondaryLink} !mt-3`}>
              Join {pool.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const FIRST_RUN_STEPS = [
  ["Join a pool", "Pick the kind of game you want to play."],
  ["Make your picks", "Choose before the first game of the week kicks off."],
  ["Watch it play out", "Check the standings and come back next week."],
] as const;

/** What a signed-in person who is in no pool yet sees on Home. */
function FirstRunWelcome({ name, pools }: { name?: string; pools: JoinablePool[] }) {
  if (pools.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-6 pb-6 pt-6">
        <section className="rounded-[20px] border border-brand-border bg-brand-surface p-5">
          <h1 className="text-3xl font-semibold leading-tight text-brand-text">No pools open yet</h1>
          <p className="mt-2 text-sm text-brand-muted">
            Nothing to join right now. Check back soon, new pools show up here as soon as the brewery opens them.
          </p>
        </section>
        <Footer />
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-lg space-y-6 px-6 pb-6 pt-6">
      <section className="rounded-[20px] border border-brand-border bg-brand-surface p-5">
        <h1 className="text-3xl font-semibold leading-tight text-brand-text">Welcome{name ? `, ${name}` : ""}</h1>
        <p className="mt-2 text-sm text-brand-muted">
          You're signed in. Join a pool below to start playing. It takes one tap.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-brand-muted">How it works</h2>
        <ol className="space-y-3">
          {FIRST_RUN_STEPS.map(([title, text], index) => (
            <li key={title} className="flex gap-3">
              <span
                aria-hidden="true"
                className="grid h-7 w-7 flex-none place-items-center rounded-full bg-brand-accent-soft text-sm font-semibold text-brand-accent"
              >
                {index + 1}
              </span>
              <p className="text-sm text-brand-muted">
                <span className="block font-semibold text-brand-text">{title}</span>
                {text}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <JoinCards pools={pools} heading="Pools you can join" />
      <Footer />
    </div>
  );
}

export function Home() {
  const { data, error, reload } = useApi<MeSummary>("/me/summary");
  const { data: session } = useSession();
  const nowMs = useServerNow(data?.serverNow);
  const [chosenId, setChosenId] = useState<string | null>(() => sessionStorage.getItem(SELECTED_KEY));

  // The week locked while Home was open: ask the server what the screen should show now.
  const onLocked = useCallback(() => void reload(), [reload]);

  useEffect(() => {
    if (chosenId) sessionStorage.setItem(SELECTED_KEY, chosenId);
  }, [chosenId]);

  if (error && !data) {
    return (
      <p className="px-6 pt-6 text-sm text-brand-muted">
        We couldn't load your pools. Check your connection and try again.
      </p>
    );
  }
  // Nothing is shown until the server has answered, so a returning player never sees the
  // first-run welcome flash.
  if (!data) return null;

  if (data.entries.length === 0) return <FirstRunWelcome name={session?.user.name} pools={data.joinablePools} />;

  const ordered = attentionOrder(data.entries);
  const selected = data.entries.find((e) => e.entryId === chosenId) ?? ordered[0]!;
  const openPickEm = data.joinablePools.filter((p) => p.type === "pick_em");
  const offerPickEm = selected.poolType === "survivor" && selected.state === "eliminated" ? openPickEm : [];
  const others = data.joinablePools.filter((p) => !offerPickEm.includes(p));

  return (
    <div className="mx-auto max-w-lg space-y-4 px-6 pb-6 pt-4">
      <PoolChips
        pools={data.entries.map((e) => ({ id: e.entryId, name: e.poolName }))}
        selectedId={selected.entryId}
        onSelect={setChosenId}
      />
      <Hero entry={selected} nowMs={nowMs} onLocked={onLocked} />
      <InstallCard />

      {offerPickEm.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-brand-muted">Still want in on the action?</h2>
          <ul className="space-y-3">
            {offerPickEm.map((pool) => (
              <li key={pool.id} className="rounded-[14px] border border-brand-border bg-brand-surface p-4">
                <p className="font-semibold text-brand-text">{pool.name}</p>
                <p className="mt-1 text-sm text-brand-muted">Pick every game, every week.</p>
                <Link to={`/join/${pool.id}`} className={`${secondaryLink} !mt-3`}>
                  Join {pool.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <JoinCards pools={others} heading="Pools you can join" />
      <AtTheBrewery brewery={data.brewery} />
      <Footer />
    </div>
  );
}
