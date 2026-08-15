/**
 * Deterministic cross-training load engine for time-based disciplines:
 * walking, weight training, and yoga.
 *
 * Unlike running, these disciplines are not analyzed on distance/pace. We only
 * reliably capture DURATION and SESSION COUNT, so load is measured in minutes
 * via the same Acute:Chronic Workload Ratio (ACWR) framework used for mileage:
 *
 *   acute   = minutes trained in the trailing 7 days
 *   chronic = average weekly minutes over the trailing 28 days (28d total / 4)
 *   acwr    = acute / chronic
 *
 * The healthy band is 0.8–1.3 (same sweet spot as mileage ACWR). Above 1.5 is
 * the spike/danger zone; below 0.8 means detraining headroom. Each week also
 * gets a concrete, discipline-specific "what to adjust" instruction expressed
 * in minutes and sessions — the only levers we can compute from the data.
 *
 * This module is the single source of truth for these numbers. The narrative
 * never invents load math.
 */

import { metersToMiles } from "@/lib/units"

export type Discipline = "walking" | "strength" | "yoga"

export type CrossFlagDirection = "rampup" | "cutback" | "hold"
export type CrossFlagSeverity = "low" | "moderate" | "high"

export interface CrossFlag {
  direction: CrossFlagDirection
  severity: CrossFlagSeverity
  /** One-sentence explanation of the load state. */
  reason: string
  /** Concrete, imperative adjustment the athlete should make next week. */
  adjustment: string
}

export interface CrossActivityInput {
  id: string
  startDate: Date
  movingTimeS: number
  /** Meters covered. 0 for non-distance disciplines (strength, yoga). */
  distanceM?: number
}

export interface CrossWeekStats {
  weekStart: string // yyyy-mm-dd (Monday, UTC)
  weekEnd: string
  minutes: number
  sessions: number
  avgSessionMin: number | null
  /** Weekly distance in miles. 0 for non-distance disciplines. */
  miles: number
  /** Average pace in seconds per mile, or null when no distance was covered. */
  avgPaceSecPerMile: number | null
  acuteMin: number
  chronicMin: number
  acwr: number | null
  wowChangePct: number | null
  flag: CrossFlag
}

export interface DisciplineConfig {
  discipline: Discipline
  label: string
  /** Sensible weekly session cadence used to phrase "sessions" adjustments. */
  typicalSessionMin: number
}

export const DISCIPLINE_CONFIG: Record<Discipline, DisciplineConfig> = {
  walking: { discipline: "walking", label: "Walking", typicalSessionMin: 45 },
  strength: { discipline: "strength", label: "Weight training", typicalSessionMin: 45 },
  yoga: { discipline: "yoga", label: "Yoga", typicalSessionMin: 40 },
}

// ---------- date helpers (ISO week starting Monday, in UTC) ----------

function startOfIsoWeek(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = date.getUTCDay()
  const diff = (day === 0 ? -6 : 1) - day
  date.setUTCDate(date.getUTCDate() + diff)
  return date
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setUTCDate(c.getUTCDate() + n)
  return c
}

function round(n: number, dp = 1): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

/** Sum of minutes in the (end-days, end] window. */
function windowMinutes(sorted: CrossActivityInput[], end: Date, days: number): number {
  const start = addDays(end, -days)
  let total = 0
  for (const a of sorted) {
    if (a.startDate > start && a.startDate <= end) {
      total += a.movingTimeS / 60
    }
  }
  return total
}

export function computeCrossWeeklyStats(
  activitiesIn: CrossActivityInput[],
  config: DisciplineConfig,
): CrossWeekStats[] {
  if (activitiesIn.length === 0) return []

  const sorted = [...activitiesIn].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  const firstWeek = startOfIsoWeek(sorted[0].startDate)
  const lastWeek = startOfIsoWeek(sorted[sorted.length - 1].startDate)

  const weeks: Date[] = []
  for (let w = new Date(firstWeek); w <= lastWeek; w = addDays(w, 7)) {
    weeks.push(new Date(w))
  }

  const result: CrossWeekStats[] = []
  let prevMinutes: number | null = null

  for (const weekStart of weeks) {
    const weekEnd = addDays(weekStart, 7) // exclusive
    const inWeek = sorted.filter((a) => a.startDate >= weekStart && a.startDate < weekEnd)

    const minutes = inWeek.reduce((s, a) => s + a.movingTimeS / 60, 0)
    const sessions = inWeek.length
    const avgSessionMin = sessions > 0 ? minutes / sessions : null

    // Distance / pace (meaningful only for walking; 0 for strength & yoga).
    const meters = inWeek.reduce((s, a) => s + (a.distanceM ?? 0), 0)
    const miles = metersToMiles(meters)
    const durationS = inWeek.reduce((s, a) => s + a.movingTimeS, 0)
    const avgPaceSecPerMile = miles > 0 ? durationS / miles : null

    const endOfWeek = addDays(weekStart, 7)
    const acuteMin = windowMinutes(sorted, endOfWeek, 7)
    const chronicMin = windowMinutes(sorted, endOfWeek, 28) / 4
    const acwr = chronicMin > 0 ? acuteMin / chronicMin : null

    const wowChangePct =
      prevMinutes && prevMinutes > 0 ? ((minutes - prevMinutes) / prevMinutes) * 100 : null

    const flag = flagLoad(acwr, minutes, sessions, avgSessionMin, config)

    result.push({
      weekStart: ymd(weekStart),
      weekEnd: ymd(addDays(weekStart, 6)),
      minutes: round(minutes),
      sessions,
      avgSessionMin: avgSessionMin ? round(avgSessionMin) : null,
      miles: round(miles, 2),
      avgPaceSecPerMile: avgPaceSecPerMile ? Math.round(avgPaceSecPerMile) : null,
      acuteMin: round(acuteMin),
      chronicMin: round(chronicMin),
      acwr: acwr ? round(acwr, 2) : null,
      wowChangePct: wowChangePct !== null ? round(wowChangePct) : null,
      flag,
    })

    prevMinutes = minutes
  }

  return result
}

// ---------- discipline-specific narration ----------

function disciplineHint(discipline: Discipline, direction: CrossFlagDirection): string {
  // Injury/adaptation context that differs per discipline.
  if (discipline === "strength") {
    if (direction === "cutback")
      return "Strength gains happen during recovery — a spike in volume raises tendon and connective-tissue strain, so pull back and keep intensity, not volume."
    if (direction === "rampup")
      return "Add volume through an extra set or a slightly longer session rather than a heavier jump in frequency."
    return "Keep progressive overload gradual — small weekly increases in load or reps."
  }
  if (discipline === "yoga") {
    if (direction === "cutback")
      return "More yoga is rarely an injury risk, but a sudden jump can crowd out running recovery — keep it restorative this week."
    if (direction === "rampup")
      return "Yoga is a low-risk way to add mobility volume — an extra short flow is a safe addition."
    return "Maintain your current mobility cadence; consistency matters more than volume here."
  }
  // walking
  if (direction === "cutback")
    return "Walking is low-impact, but a big jump still adds cumulative time on feet that competes with run recovery — trim it slightly."
  if (direction === "rampup")
    return "Walking is the safest way to add aerobic volume — extend a walk or add an easy one."
  return "Hold your walking volume steady as active recovery."
}

function flagLoad(
  acwr: number | null,
  minutes: number,
  sessions: number,
  avgSessionMin: number | null,
  config: DisciplineConfig,
): CrossFlag {
  const { discipline, typicalSessionMin } = config
  const sessionMin = Math.round(avgSessionMin ?? typicalSessionMin)

  if (minutes === 0) {
    return {
      direction: "rampup",
      severity: "low",
      reason: `No ${config.label.toLowerCase()} logged this week.`,
      adjustment: `Add one ~${typicalSessionMin}-minute session to re-establish a baseline. ${disciplineHint(discipline, "rampup")}`,
    }
  }

  if (acwr === null) {
    return {
      direction: "hold",
      severity: "low",
      reason: "Not enough history yet to compute a reliable acute:chronic ratio.",
      adjustment: `Keep logging ${config.label.toLowerCase()} consistently for a few weeks to unlock load guidance.`,
    }
  }

  // Spike / danger zone
  if (acwr > 1.5) {
    const cutMin = Math.max(sessionMin, Math.round((minutes * (acwr - 1.3)) / acwr))
    return {
      direction: "cutback",
      severity: acwr > 1.8 ? "high" : "moderate",
      reason: `ACWR is ${acwr.toFixed(2)} — this week's time is well above your 4-week baseline (spike zone above 1.5).`,
      adjustment: `Cut roughly ${cutMin} min next week (about one ${sessionMin}-min session) to land back in the 0.8–1.3 zone. ${disciplineHint(discipline, "cutback")}`,
    }
  }

  // Upper caution band
  if (acwr > 1.3) {
    return {
      direction: "hold",
      severity: "moderate",
      reason: `ACWR is ${acwr.toFixed(2)} — nudging into the upper caution band (1.3–1.5).`,
      adjustment: `Hold at about ${Math.round(minutes)} min next week rather than adding more. ${disciplineHint(discipline, "hold")}`,
    }
  }

  // Detraining headroom
  if (acwr < 0.8) {
    const addMin = Math.max(15, Math.round((minutes || typicalSessionMin) * 0.1))
    return {
      direction: "rampup",
      severity: acwr < 0.5 ? "moderate" : "low",
      reason: `ACWR is ${acwr.toFixed(2)} — recent ${config.label.toLowerCase()} volume is below your baseline.`,
      adjustment: `There's headroom to add ~${addMin} min next week (a ~10% bump). ${disciplineHint(discipline, "rampup")}`,
    }
  }

  // Healthy sweet spot 0.8–1.3
  return {
    direction: "hold",
    severity: "low",
    reason: `ACWR is ${acwr.toFixed(2)} — squarely in the healthy 0.8–1.3 zone across ${sessions} session${sessions === 1 ? "" : "s"}.`,
    adjustment: `Maintain around ${Math.round(minutes)} min next week and progress gradually. ${disciplineHint(discipline, "hold")}`,
  }
}
