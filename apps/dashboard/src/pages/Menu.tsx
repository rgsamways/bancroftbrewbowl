import { Link, NavLink } from "react-router";
import {
  formatEventDay,
  formatEventTime,
  formatMenuPrice,
  styleLine,
  type MenuItem,
  type MusicEvent,
  type MenuSection,
  type PublicMenu,
  type PublicMusic,
} from "@bbb/shared";
import { useApi } from "../lib/useApi";
import { CalendarWeek } from "../components/CalendarWeek";

// The menu: what is pouring and what the kitchen has. Anyone can read it (the table QR code
// opens /menu with no sign-in); signed in, it sits inside the app with the Menu tab. Prices show
// only when someone typed one, and an item that has run out stays on the list, marked Out.

const LABEL_TEXT = { new: "New", seasonal: "Seasonal" } as const;

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-brand-accent-soft px-2 py-0.5 text-xs font-semibold text-brand-accent">{children}</span>;
}

/** Add-ons with a price read "Add brisket +$9"; choices with no price read as one list. */
function optionLines(item: MenuItem): string[] {
  const priced = item.options.filter((o) => o.priceCents !== null).map((o) => `Add ${o.name.toLowerCase()} +${formatMenuPrice(o.priceCents)}`);
  const plain = item.options.filter((o) => o.priceCents === null).map((o) => o.name);
  return plain.length > 0 ? [...priced, plain.join(", ")] : priced;
}

export function MenuItemRow({ item }: { item: MenuItem }) {
  const price = formatMenuPrice(item.priceCents);
  const line = styleLine(item);
  return (
    <li className={`border-b border-brand-border px-4 py-3 last:border-b-0 ${item.available ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-brand-text">
            <span className={item.available ? "" : "line-through"}>{item.name}</span>
            {item.labels.map((l) => (
              <Chip key={l}>{LABEL_TEXT[l]}</Chip>
            ))}
            {!item.available && (
              <span className="rounded-full bg-brand-surface-raised px-2 py-0.5 text-xs font-semibold text-brand-muted">Out</span>
            )}
          </p>
          {line && <p className="text-sm text-brand-muted">{line}</p>}
          {item.description && <p className="text-sm text-brand-muted">{item.description}</p>}
          {optionLines(item).map((o) => (
            <p key={o} className="text-sm text-brand-muted">
              {o}
            </p>
          ))}
        </div>
        {price && <span className="flex-none font-semibold text-brand-text">{price}</span>}
      </div>
    </li>
  );
}

function Section({ section, countAvailable }: { section: MenuSection; countAvailable?: boolean }) {
  const shown = countAvailable ? section.items.filter((i) => i.available).length : section.items.length;
  return (
    <section>
      <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-brand-muted">
        {section.name}
        <span className="text-brand-faint">{shown}</span>
      </h2>
      <ul className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
        {section.items.map((item) => (
          <MenuItemRow key={item.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

function SubTabs() {
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 flex-1 items-center justify-center rounded-[10px] text-sm font-semibold ${
      isActive ? "bg-brand-accent-soft text-brand-text" : "text-brand-muted"
    }`;
  return (
    <nav aria-label="Menu sections" className="flex gap-1 rounded-[12px] border border-brand-border bg-brand-surface p-1">
      <NavLink to="/menu" end className={cls}>
        Drinks
      </NavLink>
      <NavLink to="/menu/kitchen" className={cls}>
        Kitchen
      </NavLink>
      <NavLink to="/menu/music" className={cls}>
        Music
      </NavLink>
      <NavLink to="/menu/calendar" className={cls}>
        Calendar
      </NavLink>
    </nav>
  );
}

function MenuBody({ kitchen }: { kitchen: boolean }) {
  const { data: menu, error } = useApi<PublicMenu>("/public/menu");

  if (error && !menu) {
    return <p className="mt-6 text-sm text-brand-muted">We couldn't load the menu. Check your connection and try again.</p>;
  }
  if (!menu) return null;

  const sections = (kitchen ? menu.kitchen : menu.drinks).filter((s) => s.items.length > 0);
  return (
    <div className="mt-5 space-y-5">
      {sections.length === 0 && (
        <p className="rounded-[14px] border border-brand-border bg-brand-surface p-4 text-sm text-brand-muted">
          {kitchen ? "The kitchen menu isn't set up yet." : "The drinks menu isn't set up yet."} Check back soon.
        </p>
      )}
      {sections.map((s) => (
        <Section key={s.name} section={s} countAvailable={!kitchen} />
      ))}
      <p className="pt-2 text-xs text-brand-faint">Please drink responsibly.</p>
    </div>
  );
}

export type MenuTab = "drinks" | "kitchen" | "music" | "calendar";

const SUBTITLE: Record<MenuTab, string> = {
  drinks: "What's pouring at the brewery.",
  kitchen: "Straight out of the smokehouse.",
  music: "Live music at the brewery.",
  calendar: "What's on at the brewery.",
};

function EventRow({ event }: { event: MusicEvent }) {
  return (
    <li className="flex items-center gap-4 border-b border-brand-border px-4 py-3 last:border-b-0">
      <span className="w-14 flex-none font-semibold text-brand-accent">{formatEventDay(event.date)}</span>
      <span className="min-w-0">
        <span className="block text-brand-text">{event.title}</span>
        <span className="block text-sm text-brand-muted">{formatEventTime(event.startTime, event.endTime)}</span>
      </span>
    </li>
  );
}

function MusicBody() {
  const { data: music, error } = useApi<PublicMusic>("/public/music");
  if (error && !music) return <p className="mt-6 text-sm text-brand-muted">We couldn't load the music schedule. Check your connection and try again.</p>;
  if (!music) return null;
  const empty = music.thisWeekend.length === 0 && music.comingUp.length === 0;
  return (
    <div className="mt-5 space-y-5">
      {empty && (
        <p className="rounded-[14px] border border-brand-border bg-brand-surface p-4 text-sm text-brand-muted">
          Nothing is scheduled yet. Check back soon.
        </p>
      )}
      {[
        ["This weekend", music.thisWeekend],
        ["Coming up", music.comingUp],
      ].map(
        ([title, events]) =>
          (events as MusicEvent[]).length > 0 && (
            <section key={title as string}>
              <h2 className="mb-2 text-sm font-semibold text-brand-muted">{title as string}</h2>
              <ul className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
                {(events as MusicEvent[]).map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </ul>
            </section>
          )
      )}
      <p className="pt-2 text-xs text-brand-faint">Please drink responsibly.</p>
    </div>
  );
}

function MenuContent({ tab }: { tab: MenuTab }) {
  return (
    <>
      <h1 className="text-3xl font-semibold leading-tight text-brand-text">Menu</h1>
      <p className="mt-1 text-sm text-brand-muted">{SUBTITLE[tab]}</p>
      <div className="mt-4">
        <SubTabs />
      </div>
      {tab === "calendar" ? <CalendarWeek /> : tab === "music" ? <MusicBody /> : <MenuBody kitchen={tab === "kitchen"} />}
    </>
  );
}

/** Signed in: the menu inside the app frame (header and tab bar come from the Shell). */
export function MenuPage({ tab = "drinks" }: { tab?: MenuTab }) {
  return (
    <div className="mx-auto w-full max-w-lg px-6 pt-6">
      <MenuContent tab={tab} />
    </div>
  );
}

/** Signed out (for example from the table QR code): no tab bar, and a way into the game. */
export function PublicMenuPage({ tab = "drinks" }: { tab?: MenuTab }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-6 pb-10">
      <div className="flex items-center gap-2.5 pt-6">
        <div aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-[10px] bg-brand-accent text-lg font-bold text-brand-accent-ink">
          B
        </div>
        <div className="leading-tight">
          <p className="text-base font-semibold text-brand-text">Bancroft Brewing Co.</p>
          <p className="text-xs text-brand-muted">Brew Bowl</p>
        </div>
      </div>
      <Link
        to="/"
        className="mt-5 flex min-h-14 items-center justify-between gap-3 rounded-[14px] border border-brand-border bg-brand-surface px-4"
      >
        <span className="leading-tight">
          <span className="block font-semibold text-brand-text">Play Brew Bowl</span>
          <span className="block text-sm text-brand-muted">Make your picks from your phone</span>
        </span>
        <span className="flex min-h-11 flex-none items-center rounded-[12px] bg-brand-accent px-4 font-semibold text-brand-accent-ink">Sign in</span>
      </Link>
      <main className="mt-6 flex-1">
        <MenuContent tab={tab} />
      </main>
      <p className="mt-8 text-xs text-brand-faint">You must be 19 or older to play.</p>
    </div>
  );
}
