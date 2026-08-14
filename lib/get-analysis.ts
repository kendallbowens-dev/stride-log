import "server-only"

import { db } from "@/lib/db"
import { activities, settings } from "@/lib/db/schema"
import { computeWeeklyStats, type ActivityInput, type WeekStats, type TrainingBaseline } from "@/lib/training/algorithm"
import { asc, eq } from "drizzle-orm"

export interface Analysis {
  weeks: WeekStats[]
  /** Number of real runs (Strava / CSV) driving the dashboard. 0 when nothing is populated. */
  activityCount: number
  /** Total rows in the table, including sample data — used for the Clear control. */
  totalCount: number
  /** True when at least one non-sample run (Strava / CSV) is present. */
  hasRealData: boolean
  baseline: TrainingBaseline
}

export async function getAnalysis(ownerId: string): Promise<Analysis> {
  const [rows, settingsRows] = await Promise.all([
    db.select().from(activities).where(eq(activities.ownerId, ownerId)).orderBy(asc(activities.startDate)),
    db.select().from(settings).where(eq(settings.ownerId, ownerId)).limit(1),
  ])

  const s = settingsRows[0]
  const baseline: TrainingBaseline = {
    restingHr: s?.restingHr ?? null,
    weeklyMileageGoalMiles: s?.weeklyMileageGoalMi ?? null,
    targetRace: s?.targetRace ?? null,
  }

  // Real runs (Strava / CSV) always take precedence. If any exist, sample rows
  // are ignored so seed data can never dilute a connected athlete's analysis.
  const realRows = rows.filter((r) => r.source !== "sample")
  const activeRows = realRows.length > 0 ? realRows : rows

  const input: ActivityInput[] = activeRows.map((r) => ({
    id: r.id,
    startDate: new Date(r.startDate as unknown as string),
    distanceM: r.distanceM,
    movingTimeS: r.movingTimeS,
    avgHr: r.avgHr,
  }))

  const weeks = computeWeeklyStats(input, baseline)
  return {
    weeks,
    activityCount: realRows.length,
    totalCount: rows.length,
    hasRealData: realRows.length > 0,
    baseline,
  }
}
