import { Link } from "react-router";
import { ChevronRight } from "lucide-react";

type Item = { to: string; title: string; detail: string };

const STEPS: Item[] = [{ to: "/admin/results/steps", title: "Enter results", detail: "One game at a time" }];

const TOOLS: Item[] = [
  { to: "/admin/pools", title: "All pools", detail: "Players, picks and settings" },
  { to: "/admin/activity", title: "Activity", detail: "Who changed what" },
  { to: "/admin/brewery", title: "From the brewery", detail: "Features, specials, music, announcements" },
  { to: "/admin/results", title: "Season schedule", detail: "Check the schedule is loaded" },
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
  return (
    <div className="mx-auto max-w-lg space-y-6 px-6 pb-6 pt-4">
      <h1 className="text-3xl font-semibold leading-tight text-brand-text">More</h1>
      <Group heading="Step by step" items={STEPS} />
      <Group heading="Other tools" items={TOOLS} />
      <Group heading="You" items={YOU} />
    </div>
  );
}
