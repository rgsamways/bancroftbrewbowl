import { useEffect, useState } from "react";
import type { RulesConfig } from "@bbb/shared";
import { api } from "../lib/api";

type Pool = { id: string; name: string; seasonYear: number; status: string; rules: RulesConfig };

export function CreatePoolForm({ onCreated }: { onCreated: (pool: Pool) => void }) {
  const [name, setName] = useState("");
  const [seasons, setSeasons] = useState<number[]>([new Date().getFullYear()]);
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<number[]>("/nfl/seasons").then((fetched) => {
      if (fetched.length === 0) return;
      setSeasons(fetched);
      setSeasonYear(Math.max(...fetched));
    });
  }, []);

  async function createPool(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const pool = await api<Pool>("/pools", {
        method: "POST",
        body: JSON.stringify({ name, season_year: seasonYear }),
      });
      setName("");
      onCreated(pool);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create pool");
    }
  }

  return (
    <form onSubmit={createPool} className="flex flex-col gap-3">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-brand-muted">
        Create a pool
      </h2>
      <input
        placeholder="Pool name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
        className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:outline-none"
      />
      <select
        value={seasonYear}
        onChange={(event) => setSeasonYear(Number(event.target.value))}
        className="rounded border border-brand-border bg-brand-bg px-3 py-2 text-brand-text focus:border-brand-accent focus:outline-none"
      >
        {seasons.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded bg-brand-accent px-3 py-2 font-display font-semibold text-white hover:bg-brand-accent-hover"
      >
        Create
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </form>
  );
}
