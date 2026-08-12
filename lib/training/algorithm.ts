/**
 * Deterministic training-load algorithm.
 *
 * This is the source of truth for all numbers and flags. The AI agent only
 * narrates the output of these functions — it never invents load math.
 *
 * Two dimensions are analyzed per week:
 *   1. MILEAGE load via the Acute:Chronic Workload Ratio (ACWR) + the 10% rule.
 *   2. PACE / performance trend via rolling pace and (when available) the
 *      heart-rate cost of a given pace (aerobic decoupling proxy).
 */

export type FlagDirection = "rampup" | "cutback" | "hold"
export type FlagSeverity = "low" | "moderate" | "high"

export interface Flag {
  category: "mileage" | "pace"
  direction: FlagDirection
  severity: FlagSeverity
  reason: string
}

export interface ActivityInput {
  id: string
  startDate: Date
  distanceM: number
  movingTimeS: number
  avgHr?: number | null
}

export interface WeekStats {
  weekStart: string // yyyy-mm-dd (Monday)
  weekEnd: string
  distanceKm: number
  durationS: number
  sessions: number
  avgPaceSecPerKm: number | null
  avgHr: number | null
  acuteKm: number
  chronicKm: number
  acwr: number | null
  wowChangePct: number | null // week-over-week mileage change
  hrPaceIndex: number | null // avg HR per (km/h) — lower is more efficient
  mileageFlag: Flag
  paceFlag: Flag
}

export interface TrainingBaseline {
  restingHr?: number | null
  weeklyMileageGoalKm?: number | null
  targetRace?: string | null
}

// ---------- date helpers (ISO week starting Monday, in UTC) ----------

function startOfIsoWeek(d: Date): Date {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = date.getUTCDay() // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day // shift to Monday
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

// ---------- core ----------

/**
 * Sum of distance (km) in the [end-days, end] window.
 */
function windowKm(sorted: ActivityInput[], end: Date, days: number): number {
  const start = addDays(end, -days)
  let total = 0
  for (const a of sorted) {
    if (a.startDate > start && a.startDate <= end) {
      total += a.distanceM / 1000
    }
  }
  return total
}

/**
 * Build per-week stats with ACWR and flags. Weeks are contiguous from the
 * first activity's week through the last activity's week (gaps become 0-mileage
 * weeks, which correctly drag ACWR down toward "detraining").
 */
export function computeWeeklyStats(
  activitiesIn: ActivityInput[],
  baseline: TrainingBaseline = {},
): WeekStats[] {
  if (activitiesIn.length === 0) return []

  const sorted = [...activitiesIn].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

  const firstWeek = startOfIsoWeek(sorted[0].startDate)
  const lastWeek = startOfIsoWeek(sorted[sorted.length - 1].startDate)

  const weeks: Date[] = []
  for (let w = new Date(firstWeek); w <= lastWeek; w = addDays(w, 7)) {
    weeks.push(new Date(w))
  }

  const result: WeekStats[] = []
  let prevDistanceKm: number | null = null
  const paceHistory: number[] = [] // trailing avg paces for trend
  const hrIndexHistory: number[] = []

  for (const weekStart of weeks) {
    const weekEnd = addDays(weekStart, 7) // exclusive end (start of next week)
    const inWeek = sorted.filter((a) => a.startDate >= weekStart && a.startDate < weekEnd)

    const distanceKm = inWeek.reduce((s, a) => s + a.distanceM / 1000, 0)
    const durationS = inWeek.reduce((s, a) => s + a.movingTimeS, 0)
    const sessions = inWeek.length
    const avgPaceSecPerKm = distanceKm > 0 ? durationS / distanceKm : null

    // distance-weighted average HR for the week
    const hrRuns = inWeek.filter((a) => a.avgHr && a.avgHr > 0)
    const hrDistance = hrRuns.reduce((s, a) => s + a.distanceM / 1000, 0)
    const avgHr =
      hrDistance > 0 ? hrRuns.reduce((s, a) => s + (a.avgHr as number) * (a.distanceM / 1000), 0) / hrDistance : null

    // HR cost of pace: beats per (km/h). Lower = more aerobically efficient.
    const speedKmh = avgPaceSecPerKm ? 3600 / avgPaceSecPerKm : null
    const hrPaceIndex = avgHr && speedKmh ? avgHr / speedKmh : null

    // ACWR as of the end of this week
    const endOfWeek = addDays(weekStart, 7)
    const acuteKm = windowKm(sorted, endOfWeek, 7)
    const chronicKm = windowKm(sorted, endOfWeek, 28) / 4
    const acwr = chronicKm > 0 ? acuteKm / chronicKm : null

    const wowChangePct =
      prevDistanceKm && prevDistanceKm > 0 ? ((distanceKm - prevDistanceKm) / prevDistanceKm) * 100 : null

    const mileageFlag = flagMileage(acwr, wowChangePct, distanceKm, baseline)
    const paceFlag = flagPace(avgPaceSecPerKm, paceHistory, hrPaceIndex, hrIndexHistory, acwr, sessions)

    result.push({
      weekStart: ymd(weekStart),
      weekEnd: ymd(addDays(weekStart, 6)),
      distanceKm: round(distanceKm),
      durationS,
      sessions,
      avgPaceSecPerKm: avgPaceSecPerKm ? Math.round(avgPaceSecPerKm) : null,
      avgHr: avgHr ? round(avgHr) : null,
      acuteKm: round(acuteKm),
      chronicKm: round(chronicKm),
      acwr: acwr ? round(acwr, 2) : null,
      wowChangePct: wowChangePct !== null ? round(wowChangePct) : null,
      hrPaceIndex: hrPaceIndex ? round(hrPaceIndex, 2) : null,
      mileageFlag,
      paceFlag,
    })

    prevDistanceKm = distanceKm
    if (avgPaceSecPerKm) {
      paceHistory.push(avgPaceSecPerKm)
      if (paceHistory.length > 4) paceHistory.shift()
    }
    if (hrPaceIndex) {
      hrIndexHistory.push(hrPaceIndex)
      if (hrIndexHistory.length > 4) hrIndexHistory.shift()
    }
  }

  return result
}

// ---------- mileage flagging (ACWR + 10% rule) ----------

function flagMileage(
  acwr: number | null,
  wowChangePct: number | null,
  distanceKm: number,
  baseline: TrainingBaseline,
): Flag {
  if (distanceKm === 0) {
    return {
      category: "mileage",
      direction: "rampup",
      severity: "moderate",
      reason: "No running logged this week — you have room to rebuild volume gradually before fitness fades.",
    }
  }

  if (acwr === null) {
    return {
      category: "mileage",
      direction: "hold",
      severity: "low",
      reason: "Not enough training history yet to compute a reliable acute:chronic workload ratio. Keep building a base.",
    }
  }

  // High-risk spike
  if (acwr > 1.5) {
    return {
      category: "mileage",
      direction: "cutback",
      severity: acwr > 1.8 ? "high" : "moderate",
      reason: `ACWR is ${acwr.toFixed(2)} — your recent load is well above your 4-week baseline (the injury-risk "danger zone" above 1.5). Cut back mileage next week to let your body absorb the work.`,
    }
  }

  // 10% rule breach even if ACWR still ok-ish
  if (wowChangePct !== null && wowChangePct > 10 && acwr > 1.3) {
    return {
      category: "mileage",
      direction: "cutback",
      severity: "moderate",
      reason: `Weekly mileage jumped ${Math.round(wowChangePct)}% (above the ~10% rule) and ACWR is climbing (${acwr.toFixed(2)}). Hold or trim volume to stay in the safe ramp zone.`,
    }
  }

  // Detraining / lots of headroom
  if (acwr < 0.8) {
    return {
      category: "mileage",
      direction: "rampup",
      severity: acwr < 0.5 ? "moderate" : "low",
      reason: `ACWR is ${acwr.toFixed(2)} — recent volume is below your baseline. There's headroom to add mileage (aim for a ~5–10% weekly increase).`,
    }
  }

  // Healthy sweet spot 0.8–1.3
  if (acwr <= 1.3) {
    const goalNote =
      baseline.weeklyMileageGoalKm && distanceKm < baseline.weeklyMileageGoalKm
        ? ` You're below your ${baseline.weeklyMileageGoalKm} km goal, so a small increase is reasonable.`
        : ""
    return {
      category: "mileage",
      direction: goalNote ? "rampup" : "hold",
      severity: "low",
      reason: `ACWR is ${acwr.toFixed(2)} — squarely in the healthy 0.8–1.3 zone.${goalNote || " Maintain and progress gradually."}`,
    }
  }

  // 1.3–1.5 caution band
  return {
    category: "mileage",
    direction: "hold",
    severity: "moderate",
    reason: `ACWR is ${acwr.toFixed(2)} — nudging into the upper caution band (1.3–1.5). Hold volume steady this week rather than adding more.`,
  }
}

// ---------- pace flagging (trend + HR cost of pace) ----------

function flagPace(
  avgPaceSecPerKm: number | null,
  paceHistory: number[],
  hrPaceIndex: number | null,
  hrIndexHistory: number[],
  acwr: number | null,
  sessions: number,
): Flag {
  if (avgPaceSecPerKm === null || sessions === 0) {
    return {
      category: "pace",
      direction: "hold",
      severity: "low",
      reason: "No runs this week to assess pace.",
    }
  }

  if (paceHistory.length < 2) {
    return {
      category: "pace",
      direction: "hold",
      severity: "low",
      reason: "Building a pace baseline — a couple more weeks of data will unlock pace trend analysis.",
    }
  }

  const avgPrevPace = paceHistory.reduce((s, p) => s + p, 0) / paceHistory.length
  const paceDeltaPct = ((avgPaceSecPerKm - avgPrevPace) / avgPrevPace) * 100 // negative = faster

  // HR cost of pace trend (rising index at same pace = aerobic decoupling / fatigue)
  let hrRising = false
  if (hrPaceIndex !== null && hrIndexHistory.length >= 2) {
    const avgPrevHrIndex = hrIndexHistory.reduce((s, p) => s + p, 0) / hrIndexHistory.length
    hrRising = hrPaceIndex > avgPrevHrIndex * 1.05
  }

  // Fatigue signal: pace regressing while load high, or HR cost rising sharply
  if ((paceDeltaPct > 3 && acwr !== null && acwr > 1.3) || hrRising) {
    return {
      category: "pace",
      direction: "cutback",
      severity: hrRising && paceDeltaPct > 3 ? "high" : "moderate",
      reason: hrRising
        ? "Your heart rate is higher for the same pace than in recent weeks — a classic fatigue / under-recovery signal. Back off intensity and prioritize easy running."
        : `Average pace slowed ${Math.abs(Math.round(paceDeltaPct))}% while training load is high (ACWR ${acwr?.toFixed(2)}). This points to accumulated fatigue — ease off pace work until it rebounds.`,
    }
  }

  // Improving + not overloaded: green light to push pace
  if (paceDeltaPct < -2 && (acwr === null || acwr <= 1.3)) {
    return {
      category: "pace",
      direction: "rampup",
      severity: "low",
      reason: `Average pace improved ${Math.abs(Math.round(paceDeltaPct))}% vs your recent average while load is controlled. Fitness is trending up — a good window to add a quality/tempo session.`,
    }
  }

  return {
    category: "pace",
    direction: "hold",
    severity: "low",
    reason: "Pace is stable relative to recent weeks. Keep the current mix of easy and quality running.",
  }
}

// ---------- formatting helpers (shared by UI + agent) ----------

export function formatPace(secPerKm: number | null): string {
  if (!secPerKm) return "—"
  const min = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  return `${min}:${sec.toString().padStart(2, "0")}/km`
}

export function directionLabel(d: FlagDirection): string {
  return d === "rampup" ? "Ramp up" : d === "cutback" ? "Cut back" : "Hold"
}
