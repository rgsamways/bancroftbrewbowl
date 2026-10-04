import pg from "pg";
import { databaseUrl } from "../env";
import { assertLocalDatabase } from "../guard";

// Test data lives in season years 2990 to 2999 so it never mixes with real games.
// Every row a test creates is tracked here and deleted by id in cleanup().

export const SURVIVOR_RULES = {
  allow_repeat_teams: false,
  tie_counts_as: "elimination",
  mulligans_allowed: 0,
  double_pick_weeks: [],
  tiebreaker: "playoff_performance",
  pick_deadline_rule: "first_kickoff_of_week",
};

export class TestDb {
  private client: pg.Client;
  readonly stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  private emails: string[] = [];
  private poolIds: string[] = [];
  private seasons: number[] = [];

  constructor() {
    const url = databaseUrl();
    assertLocalDatabase(url); // belt and braces: also checked when the config loads
    this.client = new pg.Client({ connectionString: url });
  }

  async connect() {
    await this.client.connect();
  }

  query(sql: string, params: unknown[] = []) {
    return this.client.query(sql, params);
  }

  email(label: string) {
    const email = `e2e-${label}-${this.stamp}@example.test`;
    this.emails.push(email);
    return email;
  }

  /** Name a user (and optionally make them an admin) after they have signed in once. */
  async setUser(email: string, name: string, isAdmin = false) {
    await this.client.query(`update "user" set name = $2, is_admin = $3 where email = $1`, [email, name, isAdmin]);
    return (await this.client.query(`select id from "user" where email = $1`, [email])).rows[0].id as string;
  }

  async createPool(name: string, seasonYear: number, type: "survivor" | "pick_em" = "survivor") {
    const rules = type === "survivor" ? SURVIVOR_RULES : { tie_handling: "void" };
    const id = (
      await this.client.query(
        `insert into pools (name, season_year, type, rules, status) values ($1, $2, $3, $4::jsonb, 'active') returning id`,
        [`${name} ${this.stamp}`, seasonYear, type, JSON.stringify(rules)]
      )
    ).rows[0].id as string;
    this.poolIds.push(id);
    if (!this.seasons.includes(seasonYear)) this.seasons.push(seasonYear);
    return id;
  }

  async createGame(seasonYear: number, week: number, home: string, away: string, kickoffInDays = 2) {
    if (!this.seasons.includes(seasonYear)) this.seasons.push(seasonYear);
    return (
      await this.client.query(
        `insert into games (season_year, week_number, home_team, away_team, kickoff_time) values ($1, $2, $3, $4, now() + ($5 || ' days')::interval) returning id`,
        [seasonYear, week, home, away, String(kickoffInDays)]
      )
    ).rows[0].id as string;
  }

  async createEntry(poolId: string, userId: string, status: "alive" | "eliminated" = "alive") {
    return (await this.client.query(`insert into entries (pool_id, user_id, status) values ($1, $2, $3) returning id`, [poolId, userId, status])).rows[0].id as string;
  }

  async addPick(entryId: string, week: number, teamCode: string) {
    await this.client.query(`insert into picks (entry_id, week_number, team_code) values ($1, $2, $3)`, [entryId, week, teamCode]);
  }

  /** Count of all rows in the tables the tests touch; used to prove cleanup leaves nothing behind. */
  async footprint() {
    const count = async (table: string) => Number((await this.client.query(`select count(*) from ${table}`)).rows[0].count);
    return { users: await count('"user"'), pools: await count("pools"), entries: await count("entries"), picks: await count("picks"), games: await count("games") };
  }

  async cleanup() {
    for (const id of this.poolIds) await this.client.query(`delete from pools where id = $1`, [id]);
    for (const year of this.seasons) await this.client.query(`delete from games where season_year = $1`, [year]);
    if (this.emails.length) {
      await this.client.query(`delete from "user" where email = any($1)`, [this.emails]);
      await this.client.query(`delete from verification where value like any($1)`, [this.emails.map((e) => `%${e}%`)]);
    }
  }

  async close() {
    await this.cleanup();
    await this.client.end();
  }
}
