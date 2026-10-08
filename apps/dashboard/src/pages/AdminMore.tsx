import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { useAccess } from "../lib/useAccess";

type Item = { to: string; title: string; detail: string };

const STEPS: Item[] = [{ to: "/admin/results/steps", title: "Enter results", detail: "One game at a time" }];

const TOOLS: Item[] = [
  { to: "/admin/pools", title: "All pools", detail: "Players, picks and settings" },
  { to: "/admin/activity", title: "Activity", detail: "Who changed what" },
  { to: "/admin/notices", title: "Notices", detail: "An important message at the top of every page" },
  { to: "/admin/calendar", title: "Calendar", detail: "Bands, specials, events and closures" },
  { to: "/admin/tv", title: "TV screens", detail: "What each TV in the brewery shows" },
  { to: "/admin/brewery", title: "From the brewery", detail: "Features, specials, music, announcements" },
  { to: "/admin/results", title: "Season schedule", detail: "Check the schedule is loaded" },
  { to: "/admin/guide", title: "Admin guide", detail: "How to run a week" },
  { to: "/admin/table-card", title: "Table card", detail: "Print the QR code for the tables" },
];

// Only the site's god-user sees these (the server refuses everyone else).
const SETUP: Item[] = [
  { to: "/admin/setup/schedule", title: "Schedule", detail: "Load a season's games from ESPN" },
  { to: "/admin/setup/admins", title: "Admins", detail: "Who has admin access" },
  { to: "/admin/setup/tv", title: "TV screens setup", detail: "Add a TV, copy its link, reset it" },
  { to: "/admin/setup/sign-in", title: "Help someone sign in", detail: "For a player who can't get in" },
];

const YOU: Item[] = [
  { to: "/", title: "Switch back to the player view", detail: "Home, Pick and Standings" },
  { to: "/account", title: "Me", detail: "Your name, email and sign out" },
];

function Group({ heading, items }: { heading: string; items: Item[] }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-brand-muted">{heading}</h2>
      <ul className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
        {items.map((item) => (
          <li key={item.to} className="border-b border-brand-border last:border-b-0">
            <Link to={item.to} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-brand-surface-raised">
              <span className="min-w-0 flex-1">
                <span className="block text-brand-text">{item.title}</span>
                <span className="block text-sm text-brand-muted">{item.detail}</span>
              </span>
              <ChevronRight className="h-4 w-4 flex-none text-brand-faint" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AdminMore() {
  const { isOperator } = useAccess();
  return (
    <div className="mx-auto max-w-lg space-y-6 px-6 pb-6 pt-4">
      <h1 className="text-3xl font-semibold leading-tight text-brand-text">More</h1>
      <Group heading="Step by step" items={STEPS} />
      <Group heading="Other tools" items={TOOLS} />
      {isOperator && <Group heading="Site setup" items={SETUP} />}
      <Group heading="You" items={YOU} />
    </div>
  );
}
