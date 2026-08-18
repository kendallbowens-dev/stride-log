import { directionLabel, formatPace } from "@/lib/format"
import type { WeekStats } from "@/lib/training/algorithm"

export interface LogBaseline {
  targetRace?: string | null
  weeklyMileageGoalMiles?: number | null
}

function dateRange(weeks: WeekStats[]): string {
  const first = weeks[0]?.weekStart
  const last = weeks[weeks.length - 1]?.weekStart
  return first && last ? `${first} → ${last}` : (last ?? "")
}

/** A short narrative summary of how the training block has trended. */
function storyParagraph(weeks: WeekStats[]): string {
  const current = weeks[weeks.length - 1]
  if (weeks.length === 1) {
    return `You've logged your first tracked week: ${current.distanceMiles} mi across ${current.sessions} runs at ${formatPace(current.avgPaceSecPerMile)}. A couple more weeks will establish the baseline the load model needs.`
  }

  const first = weeks[0]
  const volDelta = current.distanceMiles - first.distanceMiles
  const volTrend = volDelta > 0.5 ? "climbed" : volDelta < -0.5 ? "eased back" : "held steady"

  // Pace can be missing for weeks without distance-based runs.
  let paceClause = ""
  if (first.avgPaceSecPerMile !== null && current.avgPaceSecPerMile !== null) {
    const paceDelta = first.avgPaceSecPerMile - current.avgPaceSecPerMile
    const paceTrend = paceDelta > 3 ? "sharpened" : paceDelta < -3 ? "softened" : "stayed level"
    paceClause = ` while your average pace has ${paceTrend} to ${formatPace(current.avgPaceSecPerMile)}`
  }

  return [
    `Over the last ${weeks.length} weeks your volume has ${volTrend} (from ${first.distanceMiles} to ${current.distanceMiles} mi/wk)${paceClause}.`,
    `The most recent week reads **${directionLabel(current.mileageFlag.direction)}** on mileage and **${directionLabel(current.paceFlag.direction)}** on pace — ${current.mileageFlag.reason}`,
  ].join(" ")
}

/**
 * Deterministic Markdown running log built directly from the algorithm output.
 * Used as the source of truth and as a fallback when the AI narrator is unavailable.
 */
export function buildRunningLog(weeks: WeekStats[], baseline: LogBaseline): string {
  const recent = weeks.slice(-12)
  const current = recent[recent.length - 1]
  const lines: string[] = []

  lines.push(`# Running Log — ${dateRange(recent)}`)

  // The current-week metric tiles and the week-by-week table are rendered
  // elsewhere on the page, so the narrative log intentionally omits a
  // "This Week's Call" summary and a per-week recap to avoid duplication.
  lines.push("")
  lines.push("## The Story So Far")
  lines.push("")
  lines.push(storyParagraph(recent))

  const baselineBits = [
    baseline.targetRace ? `Target race: ${baseline.targetRace}.` : null,
    baseline.weeklyMileageGoalMiles ? `Weekly mileage goal: ${baseline.weeklyMileageGoalMiles} mi.` : null,
  ].filter(Boolean)
  if (baselineBits.length) {
    lines.push("")
    lines.push("## Baseline")
    lines.push("")
    baselineBits.forEach((b) => lines.push(`- ${b}`))
  }

  lines.push("")
  lines.push("## Recommendations For Next Week")
  lines.push("")
  for (const rec of recommendations(current)) lines.push(`- ${rec}`)

  return lines.join("\n")
}

function recommendations(w: WeekStats): string[] {
  const recs: string[] = []

  if (w.mileageFlag.direction === "cutback") {
    recs.push("Cut total weekly mileage by 15–25% and keep every run easy to let workload settle.")
    recs.push("Replace one run with full rest or low-impact cross-training.")
  } else if (w.mileageFlag.direction === "rampup") {
    recs.push("You have room to add volume — increase weekly mileage by no more than ~10%.")
    recs.push("Add the extra distance to easy runs, not to hard sessions.")
  } else {
    recs.push("Hold weekly mileage steady and bank consistency before the next progression.")
  }

  if (w.paceFlag.direction === "cutback") {
    recs.push("Slow your easy runs down; recent paces suggest accumulating fatigue.")
  } else if (w.paceFlag.direction === "rampup") {
    recs.push("Trends look strong — you can introduce one quality/tempo session this week.")
  } else {
    recs.push("Keep the easy/hard split honest: easy days genuinely easy, hard days with purpose.")
  }

  recs.push("Prioritize sleep and post-run fueling to support recovery.")
  return recs
}
