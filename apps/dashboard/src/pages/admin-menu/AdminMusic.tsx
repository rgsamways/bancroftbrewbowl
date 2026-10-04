import { Link } from "react-router";
import { ChevronRight, Plus } from "lucide-react";
import { formatEventDay, formatEventTime, type AdminMusic as AdminMusicData, type MusicEvent } from "@bbb/shared";
import { useApi } from "../../lib/useApi";
import { buttonClass } from "../admin-pool/shared";

// The music list as admins see it: what is coming up, and what has been (never shown to players).

function Row({ event }: { event: MusicEvent }) {
  return (
    <li className="border-b border-brand-border last:border-b-0">
      <Link to={`/admin/music/${event.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-brand-surface-raised">
        <span className="w-14 flex-none font-semibold text-brand-accent">{formatEventDay(event.date)}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-brand-text">{event.title}</span>
          <span className="block text-sm text-brand-muted">{formatEventTime(event.startTime, event.endTime)}</span>
        </span>
        <ChevronRight className="h-4 w-4 flex-none text-brand-faint" aria-hidden="true" />
      </Link>
    </li>
  );
}

export function AdminMusicList() {
  const { data, error } = useApi<AdminMusicData>("/music/events");
  if (error && !data) return <p className="text-sm text-brand-muted">We couldn't load the music schedule. Check your connection and try again.</p>;
  if (!data) return null;
  return (
    <>
      <Link to="/admin/music/new" className={buttonClass}>
        <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
        Add music or an event
      </Link>
      <section>
        <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-brand-muted">
          Coming up <span className="text-brand-faint">{data.comingUp.length}</span>
        </h2>
        {data.comingUp.length === 0 ? (
          <p className="rounded-[14px] border border-brand-border bg-brand-surface p-4 text-sm text-brand-muted">Nothing is scheduled yet. Add the first one above.</p>
        ) : (
          <ul className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface">
            {data.comingUp.map((e) => (
              <Row key={e.id} event={e} />
            ))}
          </ul>
        )}
      </section>
      {data.past.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-brand-muted">Past</h2>
          <ul className="overflow-hidden rounded-[14px] border border-brand-border bg-brand-surface opacity-80">
            {data.past.map((e) => (
              <Row key={e.id} event={e} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
