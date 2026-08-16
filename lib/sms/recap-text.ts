import "server-only"

import type { Analysis } from "@/lib/get-analysis"
import { directionLabel } from "@/lib/format"

/**
 * Builds a concise, SMS-friendly weekly recap from the deterministic analysis.
 * Every number here originates in the training algorithm — this only formats
 * what has already been computed, it never invents load math.
 *
 * Kept compact (typically < 320 chars) so it fits in one or two SMS segments.
 */
export function buildRecapText(analysis: Analysis): string {
  const { weeks, disciplines, hasRealData } = analysis
  const lines: string[] = ["Stride weekly recap"]

  // --- Running (headline) ---
  const latest = weeks[weeks.length - 1]
  if (hasRealData && latest) {
    const acwr = latest.acwr != null ? latest.acwr.toFixed(2) : "—"
    const call = directionLabel(latest.mileageFlag.direction)
    lines.push(`Run: ${latest.distanceMiles.toFixed(1)} mi / ${latest.sessions} runs, ACWR ${acwr}. ${call}.`)
    // The most actionable running instruction is the mileage flag reason.
    if (latest.mileageFlag.reason) lines.push(`→ ${latest.mileageFlag.reason}`)
  } else {
    lines.push("Run: no runs logged last week.")
  }

  // --- Cross-training disciplines (only those with data) ---
  for (const d of disciplines) {
    const w = d.weeks[d.weeks.length - 1]
    if (!w || d.sessionCount === 0 || w.sessions === 0) continue
    const call = directionLabel(w.flag.direction)
    lines.push(`${d.label}: ${w.sessions}x / ${Math.round(w.minutes)} min. ${call} — ${w.flag.adjustment}`)
  }

  if (lines.length === 1) {
    lines.push("No training logged last week. Time to get moving.")
  }

  return lines.join("\n")
}
