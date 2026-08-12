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

function callSentence(kind: "Mileage" | "Pace", w: WeekStats): string {
  const flag = kind === "Mileage" ? w.mileageFlag : w.paceFlag
  return `**${kind}:** ${directionLabel(flag.direction)} — ${flag.reason}`
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

  lines.push("")
  lines.push("## This Week's Call")
  lines.push("")
  lines.push(`- ${callSentence("Mileage", current)}`)
  lines.push(`- ${callSentence("Pace", current)}`)
  if (current.acwr !== null) {
    lines.push(`- Acute:chronic workload ratio is **${current.acwr}** (0.8–1.3 is the sweet spot).`)
  }

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
  lines.push("## Weekly Log")
  lines.push("")
  for (const w of recent) {
    const acwr = w.acwr !== null ? `ACWR ${w.acwr}` : "ACWR n/a"
    const wow =
      w.wowChangePct !== null ? `, ${w.wowChangePct > 0 ? "+" : ""}${w.wowChangePct}% vol wk/wk` : ""
    const flags: string[] = []
    if (w.mileageFlag.direction !== "hold") flags.push(`mileage ${directionLabel(w.mileageFlag.direction).toLowerCase()}`)
    if (w.paceFlag.direction !== "hold") flags.push(`pace ${directionLabel(w.paceFlag.direction).toLowerCase()}`)
    const flagText = flags.length ? ` — ${flags.join(", ")}` : ""
    lines.push(
      `- **${w.weekStart}**: ${w.distanceMiles} mi / ${w.sessions} runs, ${formatPace(w.avgPaceSecPerMile)}, ${acwr}${wow}${flagText}`,
    )
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
