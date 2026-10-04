import { Link, NavLink } from "react-router";
import { formatMenuPrice, styleLine, type MenuItem, type MenuSection, type PublicMenu } from "@bbb/shared";
import { useApi } from "../lib/useApi";

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

function MenuContent({ kitchen }: { kitchen: boolean }) {
  return (
    <>
      <h1 className="text-3xl font-semibold leading-tight text-brand-text">Menu</h1>
      <p className="mt-1 text-sm text-brand-muted">{kitchen ? "Straight out of the smokehouse." : "What's pouring at the brewery."}</p>
      <div className="mt-4">
        <SubTabs />
      </div>
      <MenuBody kitchen={kitchen} />
    </>
  );
}

/** Signed in: the menu inside the app frame (header and tab bar come from the Shell). */
export function MenuPage({ kitchen = false }: { kitchen?: boolean }) {
  return (
    <div className="mx-auto w-full max-w-lg px-6 pt-6">
      <MenuContent kitchen={kitchen} />
    </div>
  );
}

/** Signed out (for example from the table QR code): no tab bar, and a way into the game. */
export function PublicMenuPage({ kitchen = false }: { kitchen?: boolean }) {
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
        <MenuContent kitchen={kitchen} />
      </main>
      <p className="mt-8 text-xs text-brand-faint">You must be 19 or older to play.</p>
    </div>
  );
}
