import "server-only"

import { db } from "@/lib/db"
import { logEntries } from "@/lib/db/schema"
import { getAnalysis } from "@/lib/get-analysis"
import type { WeekStats } from "@/lib/training/algorithm"
import { directionLabel, formatPace } from "@/lib/format"
import { generateText } from "ai"
import { desc, eq } from "drizzle-orm"

const MODEL = "openai/gpt-5.2"

function buildContext(
  weeks: WeekStats[],
  baseline: { targetRace?: string | null; weeklyMileageGoalMiles?: number | null },
) {
  const recent = weeks.slice(-12)
  const lines = recent.map((w) => {
    return [
      `Week of ${w.weekStart}:`,
      `${w.distanceMiles} mi over ${w.sessions} runs`,
      `avg pace ${formatPace(w.avgPaceSecPerMile)}`,
      w.avgHr ? `avg HR ${w.avgHr}` : null,
      w.acwr !== null ? `ACWR ${w.acwr}` : "ACWR n/a",
      w.wowChangePct !== null ? `week-over-week ${w.wowChangePct > 0 ? "+" : ""}${w.wowChangePct}%` : null,
      `| MILEAGE: ${directionLabel(w.mileageFlag.direction)} (${w.mileageFlag.severity}) — ${w.mileageFlag.reason}`,
      `| PACE: ${directionLabel(w.paceFlag.direction)} (${w.paceFlag.severity}) — ${w.paceFlag.reason}`,
    ]
      .filter(Boolean)
      .join(" ")
  })

  const baselineLine = [
    baseline.targetRace ? `Target race: ${baseline.targetRace}.` : null,
    baseline.weeklyMileageGoalMiles ? `Weekly mileage goal: ${baseline.weeklyMileageGoalMiles} mi.` : null,
  ]
    .filter(Boolean)
    .join(" ")

  return { context: lines.join("\n"), baselineLine, current: recent[recent.length - 1] }
}

const NEXT_WEEK_ADVICE: Record<WeekStats["mileageFlag"]["direction"], string> = {
  rampup: "you've got room to add a little more mileage next week, so nudge it up gently.",
  cutback: "your body could use a lighter week, so pull the mileage back a bit and keep the easy runs truly easy.",
  hold: "keep next week about the same and let the consistency do the work.",
}

/** Short, conversational fallback used when AI narration is unavailable. */
function buildCoachNote(current: WeekStats): string {
  const runs = current.sessions === 1 ? "1 run" : `${current.sessions} runs`
  const opener = `Nice work this week: ${current.distanceMiles} mi across ${runs}.`
  const advice = NEXT_WEEK_ADVICE[current.mileageFlag.direction]
  const pace =
    current.paceFlag.direction === "cutback"
      ? " Your pace is running a bit hot for the effort, so ease off on the fast days."
      : ""
  return `${opener} Looking at your load, ${advice}${pace}`
}

export type GenerateLogResult =
  | { ok: true; markdown: string; weekStart: string; source: "ai" | "algorithm"; notice?: string }
  | { ok: false; error: string }

/** Generates and stores the training log for one owner. Session-independent so cron can call it. */
export async function generateLogForOwner(ownerId: string): Promise<GenerateLogResult> {
  const { weeks, baseline, activityCount } = await getAnalysis(ownerId)
  if (activityCount === 0 || weeks.length === 0) {
    return { ok: false, error: "No activities to analyze yet. Load sample data or import runs first." }
  }

  const { context, baselineLine, current } = buildContext(weeks, baseline)

  const system = [
    "You are the athlete's running coach, sending them a quick message about their training.",
    "You are given per-week statistics and pre-computed cut-back / ramp-up flags derived from an acute:chronic workload ratio (ACWR) and pace/heart-rate trends.",
    "The numbers and flag directions are the source of truth: NEVER contradict them, recompute them, or invent values not present.",
    "Talk directly to the athlete in second person, like a friendly coach texting them. Warm, plain, honest.",
    "Keep it SHORT: 2-4 sentences total, under 70 words. One sentence on how things are going, then the single most important thing to do next week.",
    "No headings, no bullet lists, no tables, no jargon like 'ACWR' unless explaining it in plain words. Don't recite stats the athlete can already see; mention at most one number.",
    "All distances are in miles and all paces are per mile. Never use kilometers.",
  ].join("\n")

  const prompt = [
    baselineLine ? `Athlete context: ${baselineLine}` : "",
    `Most recent week starts ${current.weekStart}.`,
    "Weekly data (oldest to newest):",
    context,
  ]
    .filter(Boolean)
    .join("\n\n")

  // The deterministic builder is the source of truth and the guaranteed fallback.
  let markdown = buildCoachNote(current)
  let source: "ai" | "algorithm" = "algorithm"
  let notice: string | undefined
  try {
    const { text } = await generateText({ model: MODEL, system, prompt })
    if (text.trim()) {
      markdown = text
      source = "ai"
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.log("[v0] AI narration unavailable, using algorithm-generated log:", message)
    notice = /credit card|quota|billing|402|403/i.test(message)
      ? "AI narration is unavailable (AI Gateway needs billing enabled), so this log was generated directly from the training algorithm."
      : "AI narration was unavailable, so this log was generated directly from the training algorithm."
  }

  const summary = {
    weeks: weeks.length,
    latestWeek: current.weekStart,
    latestAcwr: current.acwr,
    mileageDirection: current.mileageFlag.direction,
    paceDirection: current.paceFlag.direction,
    source,
  }

  const weekStart = current.weekStart
  await db
    .insert(logEntries)
    .values({ ownerId, weekStart, generatedMarkdown: markdown, summaryJson: summary })
    .onConflictDoUpdate({
      target: [logEntries.ownerId, logEntries.weekStart],
      set: { generatedMarkdown: markdown, summaryJson: summary },
    })

  return { ok: true, markdown, weekStart, source, notice }
}

export async function getLatestLogForOwner(ownerId: string) {
  const rows = await db
    .select()
    .from(logEntries)
    .where(eq(logEntries.ownerId, ownerId))
    .orderBy(desc(logEntries.weekStart))
    .limit(1)
  return rows[0] ?? null
}
