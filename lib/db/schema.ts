import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  date,
  unique,
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

export const logEntries = pgTable(
  "log_entries",
  {
    id: serial("id").primaryKey(),
    ownerId: text("owner_id").notNull().default("default"),
    weekStart: date("week_start").notNull(),
    generatedMarkdown: text("generated_markdown").notNull(),
    summaryJson: jsonb("summary_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    // The log upsert relies on this to ON CONFLICT one row per owner/week.
    ownerWeekUnique: unique("log_entries_owner_week_unique").on(t.ownerId, t.weekStart),
  }),
)

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

// --- Better Auth tables (camelCase column names must match Better Auth defaults) ---

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export type Activity = typeof activities.$inferSelect
export type NewActivity = typeof activities.$inferInsert
export type Settings = typeof settings.$inferSelect
export type LogEntry = typeof logEntries.$inferSelect
