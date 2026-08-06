import {
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  real,
} from "drizzle-orm/pg-core";

// Error monitoring — captured runtime errors + health events (Sentry-style,
// self-hosted in the app DB). Read via /api/monitoring.
export const errorLog = pgTable("error_log", {
  id: serial("id").primaryKey(),
  level: text("level").notNull().default("error"), // error | warn | info
  source: text("source").notNull(), // route / module that threw
  message: text("message").notNull(),
  stack: text("stack"),
  context: jsonb("context"), // arbitrary metadata (url, params, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Daily Picks tracking — records each day's published picks so their real
// outcomes can be settled and reported (accuracy over time).
export const dailyPicks = pgTable("daily_picks", {
  id: serial("id").primaryKey(),
  pickDate: text("pick_date").notNull(), // YYYY-MM-DD
  match: text("match").notNull(),
  league: text("league").notNull(),
  leagueSlug: text("league_slug"),
  eventId: text("event_id"),
  picks: jsonb("picks").notNull(), // top3 [{name, selection, hitRate, outcome}]
  hits: integer("hits").notNull().default(0),
  misses: integer("misses").notNull().default(0),
  pending: integer("pending").notNull().default(0),
  status: text("status").notNull().default("pending"), // pending | settled
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Cached real per-team stat profiles (multi-provider data mesh) — avoids
// re-fetching ~20 ESPN calls per team on every prediction. TTL-checked on read.
export const teamProfiles = pgTable("team_profiles", {
  id: serial("id").primaryKey(),
  teamKey: text("team_key").notNull(), // normalized "slug|teamname"
  profile: jsonb("profile").notNull(), // full MeshProfile
  providers: jsonb("providers").notNull(), // string[] of contributing sources
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Stored ĞIGI GIVØ prediction runs (L12 recursive learning log).
export const predictions = pgTable("predictions", {
  id: serial("id").primaryKey(),
  matchLabel: text("match_label").notNull(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  league: text("league").notNull(),
  matchDate: text("match_date").notNull(),
  leagueSlug: text("league_slug"),
  eventId: text("event_id"),
  tournamentStage: text("tournament_stage").notNull(),
  topPick: text("top_pick").notNull(),
  topHitRate: real("top_hit_rate").notNull(),
  totalMarkets: integer("total_markets").notNull(),
  qualifiedMarkets: integer("qualified_markets").notNull(),
  dataCompleteness: integer("data_completeness").notNull(),
  result: jsonb("result").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PredictionRow = typeof predictions.$inferSelect;
export type NewPrediction = typeof predictions.$inferInsert;

// Performance tracking — records every post-match verification result
export const performanceLog = pgTable("performance_log", {
  id: serial("id").primaryKey(),
  eventId: text("event_id").notNull(),
  matchLabel: text("match_label").notNull(),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  league: text("league").notNull(),
  leagueSlug: text("league_slug"),
  matchDate: text("match_date").notNull(),
  homeScore: integer("home_score").notNull(),
  awayScore: integer("away_score").notNull(),
  totalPicks: integer("total_picks").notNull(),
  hits: integer("hits").notNull(),
  misses: integer("misses").notNull(),
  pending: integer("pending").notNull(),
  accuracy: real("accuracy").notNull(), // hits / (hits+misses)
  top10Detail: jsonb("top10_detail").notNull(), // full top10 with outcomes
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PerformanceRow = typeof performanceLog.$inferSelect;
export type NewPerformance = typeof performanceLog.$inferInsert;

// User settings (PIN auth + preferences)
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  pin: text("pin").notNull(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Bankroll tracker
export const bankroll = pgTable("bankroll", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // "deposit" | "withdraw" | "bet" | "win"
  amount: real("amount").notNull(), // positive = in, negative = out
  balance: real("balance").notNull(), // running balance after this entry
  description: text("description").notNull(),
  matchLabel: text("match_label"),
  odds: real("odds"),
  stake: real("stake"),
  profit: real("profit"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type BankrollRow = typeof bankroll.$inferSelect;

// Accumulator slips
export const savedSlips = pgTable("saved_slips", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slipType: text("slip_type").notNull(), // "highhit" | "value"
  picks: jsonb("picks").notNull(),
  combinedOdds: real("combined_odds").notNull(),
  combinedProb: real("combined_prob").notNull(),
  stake: real("stake"),
  status: text("status").notNull(), // "pending" | "won" | "lost"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
