/**
 * Per-workout classification and recommendations.
 *
 * This is a deterministic, display-oriented layer: given the individual
 * workouts inside a single week, it labels each one (long run, quality, easy,
 * recovery, strength, mobility, ...) and produces a concrete, plain-language
 * recommendation. Like the rest of the training engine, the narrative never
 * invents numbers — every recommendation is derived from the workout's own
 * metrics relative to its week.
 *
 * Client-safe: no server-only imports.
 */

export type WorkoutKind = "run" | "walking" | "strength" | "yoga"

/** A single activity, flattened and serializable for client rendering. */
export interface WorkoutItem {
  id: string
  name: string | null
  kind: WorkoutKind
  /** ISO timestamp string. */
  startDate: string
  /** Miles covered (0 for strength / yoga). */
  distanceMiles: number
  /** Duration in minutes. */
  durationMin: number
  avgHr: number | null
  /** Seconds per mile, or null when no distance was covered. */
  paceSecPerMile: number | null
}

export interface WorkoutInsight {
  /** Short label, e.g. "Long run", "Quality", "Easy", "Recovery". */
  tag: string
  /** One or two sentences of concrete, actionable guidance. */
  recommendation: string
}

/** ISO-week Monday (UTC) for a timestamp, as yyyy-mm-dd. Mirrors the engine. */
export function isoWeekStartYmd(iso: string): string {
  const d = new Date(iso)
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = date.getUTCDay()
  const diff = (day === 0 ? -6 : 1) - day
  date.setUTCDate(date.getUTCDate() + diff)
  return date.toISOString().slice(0, 10)
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Recommend for a single RUN, using the other runs in the same week as context
 * (to spot the long run, the fastest run, and easy volume).
 */
function recommendRun(w: WorkoutItem, weekRuns: WorkoutItem[]): WorkoutInsight {
  const distances = weekRuns.map((r) => r.distanceMiles).filter((d) => d > 0)
  const paces = weekRuns.map((r) => r.paceSecPerMile).filter((p): p is number => p !== null)
  const medianDist = median(distances)
  const longest = distances.length ? Math.max(...distances) : 0
  const fastest = paces.length ? Math.min(...paces) : null
  const avgPace = paces.length ? paces.reduce((s, p) => s + p, 0) / paces.length : null

  // Long run: the week's longest and meaningfully above the typical run.
  if (w.distanceMiles > 0 && w.distanceMiles === longest && weekRuns.length > 1 && w.distanceMiles >= medianDist * 1.3) {
    return {
      tag: "Long run",
      recommendation:
        "Your longest run of the week — the key aerobic-endurance stimulus. Keep the effort conversational; if it felt controlled, you can extend it about 5–10% next week rather than speeding it up.",
    }
  }

  // Quality / tempo: notably faster than the week's average pace.
  if (w.paceSecPerMile !== null && avgPace !== null && w.paceSecPerMile === fastest && w.paceSecPerMile <= avgPace * 0.95 && weekRuns.length > 1) {
    return {
      tag: "Quality",
      recommendation:
        "Your fastest run this week — treat it as your quality/tempo session. Bracket hard efforts like this with easy or rest days so the adaptation sticks and injury risk stays low.",
    }
  }

  // Recovery: short and easy relative to the week.
  if (w.distanceMiles > 0 && w.distanceMiles <= medianDist * 0.6 && (avgPace === null || (w.paceSecPerMile ?? 0) >= avgPace)) {
    return {
      tag: "Recovery",
      recommendation:
        "Short and easy — exactly what a recovery run should be. Resist pushing the pace here; its job is to add easy blood flow without adding fatigue.",
    }
  }

  // Elevated HR relative to pace (only if we have HR).
  if (w.avgHr && w.avgHr > 0 && avgPace !== null && w.paceSecPerMile !== null && w.paceSecPerMile >= avgPace) {
    return {
      tag: "Easy / steady",
      recommendation:
        "A steady aerobic run at easy effort. The bulk of weekly volume should look like this — keep it comfortable enough to hold a conversation.",
    }
  }

  return {
    tag: "Easy / steady",
    recommendation:
      "A solid steady run. Most of your weekly mileage should sit at this easy effort to build the aerobic base that supports your harder days.",
  }
}

function recommendWalking(w: WorkoutItem, weekWorkouts: WorkoutItem[]): WorkoutInsight {
  const longest = Math.max(...weekWorkouts.map((x) => x.durationMin), 0)
  if (w.durationMin === longest && weekWorkouts.length > 1) {
    return {
      tag: "Long walk",
      recommendation:
        "Your longest walk this week — great low-impact aerobic time on feet and active recovery for your legs. Keep it relaxed; it complements running without adding pounding.",
    }
  }
  return {
    tag: "Walk",
    recommendation:
      "Easy aerobic volume with almost no injury cost. Walks like this are a safe way to add time on feet on recovery days between harder runs.",
  }
}

function recommendStrength(w: WorkoutItem, weekWorkouts: WorkoutItem[]): WorkoutInsight {
  const sorted = [...weekWorkouts].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
  const idx = sorted.findIndex((x) => x.id === w.id)
  const prev = idx > 0 ? sorted[idx - 1] : null
  // Flag back-to-back strength days (< ~24h apart).
  if (prev) {
    const gapH = (new Date(w.startDate).getTime() - new Date(prev.startDate).getTime()) / 3.6e6
    if (gapH < 24) {
      return {
        tag: "Strength (back-to-back)",
        recommendation:
          "This session landed less than a day after your last strength workout. Tissue adapts during recovery — try to leave at least a full day between lifting sessions, especially around hard runs.",
      }
    }
  }
  return {
    tag: "Strength",
    recommendation:
      "A strength session supports durability and running economy. Progress load gradually and keep at least a day before the next lift so connective tissue can adapt.",
  }
}

function recommendYoga(): WorkoutInsight {
  return {
    tag: "Mobility",
    recommendation:
      "Mobility and recovery work — excellent for maintaining range of motion and calming the nervous system. Consistency matters more than duration here; a short regular flow beats occasional long ones.",
  }
}

/** Classify and recommend for a single workout given its week's workouts. */
export function recommendWorkout(w: WorkoutItem, weekWorkouts: WorkoutItem[]): WorkoutInsight {
  switch (w.kind) {
    case "run":
      return recommendRun(w, weekWorkouts.filter((x) => x.kind === "run"))
    case "walking":
      return recommendWalking(w, weekWorkouts.filter((x) => x.kind === "walking"))
    case "strength":
      return recommendStrength(w, weekWorkouts.filter((x) => x.kind === "strength"))
    case "yoga":
      return recommendYoga()
  }
}
