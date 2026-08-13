import {
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  date,
} from "drizzle-orm/pg-core"

export const activities = pgTable("activities", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().default("default"),
  source: text("source").notNull().default("sample"),
  name: text("name"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  distanceM: doublePrecision("distance_m").notNull(),
  movingTimeS: integer("moving_time_s").notNull(),
  avgHr: doublePrecision("avg_hr"),
  totalElevationM: doublePrecision("total_elevation_m").default(0),
  type: text("type").default("Run"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const settings = pgTable("settings", {
  ownerId: text("owner_id").primaryKey().default("default"),
  injuryHistory: text("injury_history"),
  restingHr: integer("resting_hr"),
  targetRace: text("target_race"),
  targetRaceDate: date("target_race_date"),
  weeklyMileageGoalMi: doublePrecision("weekly_mileage_goal_mi"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const settingsBackup = pgTable("settings_backup", {
  ownerId: text("owner_id").primaryKey().default("default"),
  injuryHistory: text("injury_history"),
  restingHr: integer("resting_hr"),
  targetRace: text("target_race"),
  targetRaceDate: date("target_race_date"),
  weeklyMileageGoalMi: doublePrecision("weekly_mileage_goal_mi"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const logEntries = pgTable("log_entries", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull().default("default"),
  weekStart: date("week_start").notNull(),
  generatedMarkdown: text("generated_markdown").notNull(),
  summaryJson: jsonb("summary_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const stravaConnection = pgTable("strava_connection", {
  ownerId: text("owner_id").primaryKey().default("default"),
  athleteId: text("athlete_id"),
  athleteName: text("athlete_name"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export type Activity = typeof activities.$inferSelect
export type NewActivity = typeof activities.$inferInsert
export type Settings = typeof settings.$inferSelect
export type LogEntry = typeof logEntries.$inferSelect
