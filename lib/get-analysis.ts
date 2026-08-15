import "server-only"

import { db } from "@/lib/db"
import { activities, settings } from "@/lib/db/schema"
import { computeWeeklyStats, type ActivityInput, type WeekStats, type TrainingBaseline } from "@/lib/training/algorithm"
import {
  computeCrossWeeklyStats,
  DISCIPLINE_CONFIG,
  type CrossWeekStats,
  type Discipline,
} from "@/lib/training/cross-training"
import { asc, eq } from "drizzle-orm"

/** Strava/canonical activity types that count as a run. */
const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"])
/** Canonical activity type stored per discipline. */
const DISCIPLINE_TYPE: Record<Discipline, string> = {
  walking: "Walk",
  strength: "WeightTraining",
  yoga: "Yoga",
}

export interface DisciplineAnalysis {
  discipline: Discipline
  label: string
  weeks: CrossWeekStats[]
  /** Number of real sessions (Strava / CSV) of this discipline. */
  sessionCount: number
  /** True when this discipline tracks distance (walking) — drives distance/pace charts. */
  hasDistance: boolean
}

export interface Analysis {
  weeks: WeekStats[]
  /** Number of real runs (Strava / CSV) driving the dashboard. 0 when nothing is populated. */
  activityCount: number
  /** Total rows in the table, including sample data — used for the Clear control. */
  totalCount: number
  /** True when at least one non-sample run (Strava / CSV) is present. */
  hasRealData: boolean
  baseline: TrainingBaseline
  /** Per-discipline cross-training analysis (walking, strength, yoga). */
  disciplines: DisciplineAnalysis[]
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

  // Real activities (Strava / CSV) always take precedence. If any exist, sample
  // rows are ignored so seed data can never dilute a connected athlete's analysis.
  const realRows = rows.filter((r) => r.source !== "sample")
  const activeRows = realRows.length > 0 ? realRows : rows

  // --- Running analysis (unchanged behavior, now type-filtered) ---
  const runRows = activeRows.filter((r) => RUN_TYPES.has(r.type ?? "Run"))
  const runInput: ActivityInput[] = runRows.map((r) => ({
    id: r.id,
    startDate: new Date(r.startDate as unknown as string),
    distanceM: r.distanceM,
    movingTimeS: r.movingTimeS,
    avgHr: r.avgHr,
  }))
  const weeks = computeWeeklyStats(runInput, baseline)

  // Running activity count for headline/empty-state parity with prior behavior.
  const realRunCount = realRows.filter((r) => RUN_TYPES.has(r.type ?? "Run")).length

  // --- Cross-training analysis (walking, strength, yoga) ---
  const disciplines: DisciplineAnalysis[] = (Object.keys(DISCIPLINE_CONFIG) as Discipline[]).map((discipline) => {
    const config = DISCIPLINE_CONFIG[discipline]
    const type = DISCIPLINE_TYPE[discipline]
    const disciplineRows = activeRows.filter((r) => r.type === type)
    const input = disciplineRows.map((r) => ({
      id: r.id,
      startDate: new Date(r.startDate as unknown as string),
      movingTimeS: r.movingTimeS,
      distanceM: r.distanceM,
    }))
    const realCount = realRows.filter((r) => r.type === type).length
    const weeks = computeCrossWeeklyStats(input, config)
    return {
      discipline,
      label: config.label,
      weeks,
      sessionCount: realCount,
      // Walking is the distance-based discipline; show it distance/pace charts.
      hasDistance: discipline === "walking" && weeks.some((w) => w.miles > 0),
    }
  })

  return {
    weeks,
    activityCount: realRunCount,
    totalCount: rows.length,
    hasRealData: realRunCount > 0,
    baseline,
    disciplines,
  }
}
