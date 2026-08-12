/**
 * Presentation formatting helpers shared by the UI and the agent narrative.
 *
 * These are pure display concerns — they never compute training load, they
 * only format values the algorithm has already produced.
 */

import type { FlagDirection } from "@/lib/training/algorithm"

/** Format a pace in seconds-per-mile as `m:ss/mi`. */
export function formatPace(secPerMile: number | null): string {
  if (!secPerMile) return "—"
  const min = Math.floor(secPerMile / 60)
  const sec = Math.round(secPerMile % 60)
  return `${min}:${sec.toString().padStart(2, "0")}/mi`
}

/** Human-readable label for a flag direction. */
export function directionLabel(d: FlagDirection): string {
  return d === "rampup" ? "Ramp up" : d === "cutback" ? "Cut back" : "Hold"
}
