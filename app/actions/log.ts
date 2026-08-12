"use server"

import { db } from "@/lib/db"
import { logEntries } from "@/lib/db/schema"
import { getAnalysis } from "@/lib/get-analysis"
import { OWNER_ID } from "@/lib/owner"
import { directionLabel, formatPace, type WeekStats } from "@/lib/training/algorithm"
import { generateText } from "ai"
import { desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

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

export async function generateRunningLog() {
  const { weeks, baseline, activityCount } = await getAnalysis()
  if (activityCount === 0 || weeks.length === 0) {
    return { ok: false as const, error: "No activities to analyze yet. Load sample data or import runs first." }
  }

  const { context, baselineLine, current } = buildContext(weeks, baseline)

  const system = [
    "You are a running coach writing a training log for an athlete.",
    "You are given per-week statistics and pre-computed cut-back / ramp-up flags derived from an acute:chronic workload ratio (ACWR) and pace/heart-rate trends.",
    "The numbers and flag directions are the source of truth: NEVER contradict them, recompute them, or invent values not present.",
    "Write in Markdown. Be specific, encouraging but honest, and concise.",
    "Structure the output exactly as:",
    "# Running Log — <date range>",
    "## This Week's Call  (two clear sub-points: **Mileage** and **Pace**, each stating cut back / ramp up / hold and why, grounded in the ACWR and pace data)",
    "## The Story So Far  (2-3 short paragraphs summarizing how the block has progressed)",
    "## Weekly Log  (a compact bullet per week: date, miles, avg pace, ACWR, and the key flag)",
    "All distances are in miles and all paces are per mile. Never use kilometers.",
    "## Recommendations For Next Week  (3-5 concrete, actionable bullets on pace and mileage)",
  ].join("\n")

  const prompt = [
    baselineLine ? `Athlete context: ${baselineLine}` : "",
    `Most recent week starts ${current.weekStart}.`,
    "Weekly data (oldest to newest):",
    context,
  ]
    .filter(Boolean)
    .join("\n\n")

  let markdown: string
  try {
    const { text } = await generateText({ model: MODEL, system, prompt })
    markdown = text
  } catch (err) {
    console.log("[v0] log generation error:", err instanceof Error ? err.message : String(err))
    return { ok: false as const, error: "The AI agent could not generate the log. Please try again." }
  }

  const summary = {
    weeks: weeks.length,
    latestWeek: current.weekStart,
    latestAcwr: current.acwr,
    mileageDirection: current.mileageFlag.direction,
    paceDirection: current.paceFlag.direction,
  }

  const weekStart = current.weekStart
  await db
    .insert(logEntries)
    .values({
      ownerId: OWNER_ID,
      weekStart,
      generatedMarkdown: markdown,
      summaryJson: summary,
    })
    .onConflictDoUpdate({
      target: [logEntries.ownerId, logEntries.weekStart],
      set: { generatedMarkdown: markdown, summaryJson: summary, notionPageId: null, syncedAt: null },
    })

  revalidatePath("/")
  return { ok: true as const, markdown, weekStart }
}

export async function getLatestLog() {
  const rows = await db
    .select()
    .from(logEntries)
    .where(eq(logEntries.ownerId, OWNER_ID))
    .orderBy(desc(logEntries.weekStart))
    .limit(1)
  return rows[0] ?? null
}
