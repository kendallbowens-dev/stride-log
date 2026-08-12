import "server-only"

import { db } from "@/lib/db"
import { activities, settings } from "@/lib/db/schema"
import { OWNER_ID } from "@/lib/owner"
import { computeWeeklyStats, type ActivityInput, type WeekStats, type TrainingBaseline } from "@/lib/training/algorithm"
import { asc, eq } from "drizzle-orm"

export interface Analysis {
  weeks: WeekStats[]
  activityCount: number
  baseline: TrainingBaseline
}

export async function getAnalysis(): Promise<Analysis> {
  const [rows, settingsRows] = await Promise.all([
    db.select().from(activities).where(eq(activities.ownerId, OWNER_ID)).orderBy(asc(activities.startDate)),
    db.select().from(settings).where(eq(settings.ownerId, OWNER_ID)).limit(1),
  ])

  const s = settingsRows[0]
  const baseline: TrainingBaseline = {
    restingHr: s?.restingHr ?? null,
    weeklyMileageGoalKm: s?.weeklyMileageGoalKm ?? null,
    targetRace: s?.targetRace ?? null,
  }

  const input: ActivityInput[] = rows.map((r) => ({
    id: r.id,
    startDate: new Date(r.startDate as unknown as string),
    distanceM: r.distanceM,
    movingTimeS: r.movingTimeS,
    avgHr: r.avgHr,
  }))

  const weeks = computeWeeklyStats(input, baseline)
  return { weeks, activityCount: rows.length, baseline }
}
