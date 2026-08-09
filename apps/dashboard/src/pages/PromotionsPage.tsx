import { useEffect, useState } from "react";
import { CANNED_PROMOTION_LABELS, type CannedPromotionConfig, type PromotionKind } from "@bbb/shared";
import { api } from "../lib/api";
import { WeekPills, WeekStatus, type Week } from "../components/WeekWidgets";

type Promotion = {
  id: string;
  seasonYear: number;
  weekNumber: number;
  title: string;
  description: string;
};

type CannedPromotion = {
  id: string;
  kind: PromotionKind;
  enabled: boolean;
  config: CannedPromotionConfig;
};

export function PromotionsPage() {
  const [seasons, setSeasons] = useState<number[]>([]);
  const [seasonYear, setSeasonYear] = useState<number | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);

  useEffect(() => {
    api<number[]>("/nfl/seasons").then((fetched) => {
      const list = fetched.length > 0 ? fetched : [new Date().getFullYear()];
      setSeasons(list);
      setSeasonYear((current) => current ?? Math.max(...list));
    });
  }, []);

  useEffect(() => {
    if (seasonYear === null) return;
    api<Week[]>(`/nfl/weeks?year=${seasonYear}`).then((fetched) => {
      setWeeks(fetched);
      setSelectedWeek((current) => current ?? fetched[0]?.weekNumber ?? null);
    });
  }, [seasonYear]);

  function refreshPromotions() {
    if (seasonYear === null || selectedWeek === null) return;
    api<Promotion[]>(`/promotions?year=${seasonYear}&week=${selectedWeek}`).then(setPromotions);
  }

  useEffect(refreshPromotions, [seasonYear, selectedWeek]);

  const activeWeek = weeks.find((w) => w.weekNumber === selectedWeek);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 pb-6">
      <CannedPromotionsSection weeks={weeks} />

      <label className="flex w-28 flex-col gap-1 text-sm text-brand-muted">
        Season
        <select
          value={seasonYear ?? ""}
          onChange={(event) => setSeasonYear(Number(event.target.value))}
          className="rounded border border-brand-border bg-brand-surface px-3 py-2 text-brand-text focus:border-brand-accent focus:outline-none"
        >
          {seasons.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </label>

      {weeks.length === 0 ? (
        <p className="text-sm text-brand-muted">
          No games imported for {seasonYear} yet — run the schedule importer for this season.
        </p>
      ) : (
        <>
          <div>
            <WeekPills weeks={weeks} selectedWeek={selectedWeek} onSelect={setSelectedWeek} />
            {activeWeek && <WeekStatus week={activeWeek} />}
          </div>

          {seasonYear !== null && selectedWeek !== null && (
            <PromotionsForWeek
              seasonYear={seasonYear}
              weekNumber={selectedWeek}
              promotions={promotions}
              onChanged={refreshPromotions}
            />
          )}
        </>
      )}
    </div>
  );
}

function CannedPromotionsSection({ weeks }: { weeks: Week[] }) {
  const [items, setItems] = useState<CannedPromotion[]>([]);

  function refresh() {
    api<CannedPromotion[]>("/canned-promotions").then(setItems);
  }

  useEffect(refresh, []);

  async function toggle(kind: PromotionKind, enabled: boolean) {
    const updated = await api<CannedPromotion>(`/canned-promotions/${kind}`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    });
    setItems((current) => current.map((item) => (item.kind === kind ? updated : item)));
  }

  async function toggleMilestoneWeek(item: CannedPromotion, weekNumber: number) {
    const has = item.config.milestone_weeks.includes(weekNumber);
    const milestone_weeks = has
      ? item.config.milestone_weeks.filter((w) => w !== weekNumber)
      : [...item.config.milestone_weeks, weekNumber].sort((a, b) => a - b);
    const updated = await api<CannedPromotion>(`/canned-promotions/${item.kind}`, {
      method: "PATCH",
      body: JSON.stringify({ config: { milestone_weeks } }),
    });
    setItems((current) => current.map((i) => (i.kind === item.kind ? updated : i)));
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-3 rounded border border-brand-border bg-brand-surface p-4">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-brand-muted">
        Canned promotions
      </h2>
      {items.map((item) => (
        <div key={item.kind} className="border-b border-brand-border pb-3 last:border-0 last:pb-0">
          <label className="flex items-center justify-between gap-3 text-sm text-brand-text">
            <span>{CANNED_PROMOTION_LABELS[item.kind]}</span>
            <input
              type="checkbox"
              checked={item.enabled}
              onChange={(event) => toggle(item.kind, event.target.checked)}
              className="accent-brand-accent"
            />
          </label>
          {item.kind === "milestone_reward" && (
            <div className="mt-2 flex flex-wrap gap-1">
              {weeks.map((w) => (
                <button
                  key={w.weekNumber}
                  type="button"
                  onClick={() => toggleMilestoneWeek(item, w.weekNumber)}
                  className={`rounded px-3 py-1 text-sm font-medium ${
                    item.config.milestone_weeks.includes(w.weekNumber)
                      ? "bg-brand-accent text-white"
                      : "bg-brand-surface-raised text-brand-muted hover:text-brand-text"
                  }`}
                >
                  {w.weekNumber}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PromotionsForWeek({
  seasonYear,
  weekNumber,
  promotions,
  onChanged,
}: {
  seasonYear: number;
  weekNumber: number;
  promotions: Promotion[];
  onChanged: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api("/promotions", {
        method: "POST",
        body: JSON.stringify({ season_year: seasonYear, week_number: weekNumber, title, description }),
      });
      setTitle("");
      setDescription("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create promotion");
    }
  }

  async function remove(id: string) {
    await api(`/promotions/${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-brand-border rounded border border-brand-border bg-brand-surface">
        {promotions.map((promotion) => (
          <li key={promotion.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
            <div>
              <p className="font-semibold text-brand-text">{promotion.title}</p>
              <p className="text-brand-muted">{promotion.description}</p>
            </div>
            <button
              onClick={() => remove(promotion.id)}
              className="shrink-0 text-xs text-brand-muted hover:text-red-400"
            >
              Delete
            </button>
          </li>
        ))}
        {promotions.length === 0 && (
          <li className="px-3 py-2 text-sm text-brand-muted">No promotions for week {weekNumber} yet</li>
        )}
      </ul>

      <form
        onSubmit={create}
        className="flex flex-col gap-3 rounded border border-brand-border bg-brand-surface p-4"
      >
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-brand-muted">
          Add a promotion for week {weekNumber}
        </h2>
        <input
          placeholder="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
          rows={3}
          className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
        />
        <button
          type="submit"
          className="self-start rounded bg-brand-accent px-3 py-2 font-display font-semibold text-white hover:bg-brand-accent-hover"
        >
          Add
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </div>
  );
}
