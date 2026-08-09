import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  index,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { POOL_STATUSES, ENTRY_STATUSES, PICK_RESULTS, GAME_RESULTS } from "@bbb/shared/enums";
import type { RulesConfig } from "@bbb/shared";

// better-auth's own tables, generated via `@better-auth/cli generate`.
// Kept inline here (not a separate file) because drizzle-kit's loader
// can't resolve NodeNext-style `.js`-extension relative imports between
// two TypeScript source files.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  isAdmin: boolean("is_admin").default(false),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const poolStatusEnum = pgEnum("pool_status", POOL_STATUSES);
export const entryStatusEnum = pgEnum("entry_status", ENTRY_STATUSES);
export const pickResultEnum = pgEnum("pick_result", PICK_RESULTS);
export const gameResultEnum = pgEnum("game_result", GAME_RESULTS);

export const pools = pgTable("pools", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  seasonYear: integer("season_year").notNull(),
  sport: text("sport").notNull().default("nfl"),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  rules: jsonb("rules").$type<RulesConfig>().notNull(),
  status: poolStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const entries = pgTable("entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  poolId: uuid("pool_id")
    .notNull()
    .references(() => pools.id, { onDelete: "cascade" }),
  // Once a real account exists, name/email are resolved live from `user` —
  // never copied — so changing your name/email updates every pool/season
  // instantly. `invitedEmail`/`invitedName` only hold data for an entry an
  // admin created before that person ever signed in; they're cleared the
  // moment the account is claimed (see databaseHooks in auth.ts).
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  invitedEmail: text("invited_email"),
  invitedName: text("invited_name"),
  status: entryStatusEnum("status").notNull().default("alive"),
  eliminatedWeek: integer("eliminated_week"),
  mulligansUsed: integer("mulligans_used").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Promotions belong to an NFL season/week, not a pool — same reasoning as
// `games`: a bar's "Survivor Sunday" special for week 3 isn't specific to
// any one pool. Multiple promotions can exist for the same week.
export const promotions = pgTable("promotions", {
  id: uuid("id").primaryKey().defaultRandom(),
  seasonYear: integer("season_year").notNull(),
  weekNumber: integer("week_number").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

// Games belong to an NFL season, not a pool — the real-world result of
// KC @ BUF in week 3 of 2026 is the same fact for every pool that season,
// so it's entered once here and every pool with a matching seasonYear
// scores off the same row (see scoreGame in lib/scoring.ts).
export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seasonYear: integer("season_year").notNull(),
    weekNumber: integer("week_number").notNull(),
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    kickoffTime: timestamp("kickoff_time").notNull(),
    result: gameResultEnum("result").notNull().default("pending"),
    // Independent of `result` — a score can be entered without deciding a
    // winner, and vice versa (see PATCH /nfl/games/:gameId/score).
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    enteredBy: text("entered_by").references(() => user.id),
    enteredAt: timestamp("entered_at"),
  },
  (table) => [
    unique("games_season_week_matchup_unique").on(
      table.seasonYear,
      table.weekNumber,
      table.homeTeam,
      table.awayTeam
    ),
  ]
);

export const picks = pgTable(
  "picks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    weekNumber: integer("week_number").notNull(),
    teamCode: text("team_code").notNull(),
    result: pickResultEnum("result").notNull().default("pending"),
    lockedAt: timestamp("locked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("picks_entry_week_team_unique").on(table.entryId, table.weekNumber, table.teamCode),
  ]
);

// Persists a "wipeout" decision (a game result that would eliminate every
// remaining alive entry in a pool) so it survives past the HTTP response
// that first detected it — see scorePoolForGame in lib/scoring.ts, which
// holds back eliminations and writes a row here instead. An admin resolves
// it later via POST /pools/:poolId/wipeouts/:wipeoutId/resolve.
export const wipeoutEvents = pgTable(
  "wipeout_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => pools.id, { onDelete: "cascade" }),
    weekNumber: integer("week_number").notNull(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    candidateEntryIds: jsonb("candidate_entry_ids").$type<string[]>().notNull(),
    survivingEntryIds: jsonb("surviving_entry_ids").$type<string[]>(),
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: text("resolved_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("wipeout_events_pool_game_unresolved_unique")
      .on(table.poolId, table.gameId)
      .where(sql`${table.resolvedAt} IS NULL`),
  ]
);

export const poolsRelations = relations(pools, ({ many }) => ({
  entries: many(entries),
}));

export const entriesRelations = relations(entries, ({ one, many }) => ({
  pool: one(pools, { fields: [entries.poolId], references: [pools.id] }),
  user: one(user, { fields: [entries.userId], references: [user.id] }),
  picks: many(picks),
}));

export const picksRelations = relations(picks, ({ one }) => ({
  entry: one(entries, { fields: [picks.entryId], references: [entries.id] }),
}));

export const wipeoutEventsRelations = relations(wipeoutEvents, ({ one }) => ({
  pool: one(pools, { fields: [wipeoutEvents.poolId], references: [pools.id] }),
  game: one(games, { fields: [wipeoutEvents.gameId], references: [games.id] }),
  resolver: one(user, { fields: [wipeoutEvents.resolvedBy], references: [user.id] }),
}));
