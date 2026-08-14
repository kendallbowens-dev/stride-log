import type { NewActivity } from "@/lib/db/schema"
import { milesToMeters } from "@/lib/units"

/**
 * Generates a realistic ~14-week marathon-style build for demo/testing:
 *   - a steady base
 *   - a progressive build
 *   - a deliberate overload spike (should trigger a mileage cut-back flag)
 *   - a down/taper week (should trigger ramp-up headroom)
 * Paces drift faster over the block, with a fatigue bump during the spike so
 * the pace + HR analysis has something to detect. All distances are in MILES
 * and paces in seconds-per-mile; they are converted to meters for storage.
 */
export function generateSampleActivities(ownerId: string): NewActivity[] {
  // target weekly miles per week (index 0 = oldest); week 9 is a deliberate spike
  const weeklyMiles = [24, 25, 26, 24, 28, 30, 27, 33, 37, 45, 28, 35, 38, 26]
  // base easy pace sec/mile, improving over time (lower = faster)
  const basePace = [545, 542, 540, 537, 535, 532, 530, 527, 525, 537, 520, 517, 515, 522]
  // resting-ish HR cost; bumps during the overload spike (week index 9)
  const baseHr = [148, 147, 147, 146, 146, 145, 145, 144, 144, 156, 143, 142, 142, 145]

  const runsPerWeek = 4
  const now = new Date()
  const totalWeeks = weeklyMiles.length
  const activities: NewActivity[] = []

  // Monday of the oldest week
  const firstMonday = startOfIsoWeekUTC(addDaysUTC(now, -7 * (totalWeeks - 1)))

  for (let w = 0; w < totalWeeks; w++) {
    const weekStart = addDaysUTC(firstMonday, w * 7)
    const totalMiles = weeklyMiles[w]
    // distribute: one long run (~40%) + shorter runs
    const longRunMiles = totalMiles * 0.4
    const rest = totalMiles - longRunMiles
    const shortMiles = rest / (runsPerWeek - 1)

    // run days: Tue, Wed, Fri, Sun(long)
    const dayOffsets = [1, 2, 4, 6]
    const miles = [shortMiles, shortMiles, shortMiles, longRunMiles]

    for (let r = 0; r < runsPerWeek; r++) {
      const mi = miles[r]
      if (mi <= 0) continue
      const day = addDaysUTC(weekStart, dayOffsets[r])
      // long run a bit slower, quality (Wed) a bit faster
      let pace = basePace[w]
      if (r === 3) pace += 29 // long run slower
      if (r === 1) pace -= 24 // midweek quality faster
      // small deterministic-ish jitter
      pace += ((w * 7 + r) % 5) - 2

      const movingTimeS = Math.round(mi * pace)
      const hr = baseHr[w] + (r === 1 ? 8 : 0) + (r === 3 ? 3 : 0)

      // set the run time to mid-morning
      const start = new Date(day)
      start.setUTCHours(8, 0, 0, 0)

      activities.push({
        id: `sample-${w}-${r}`,
        ownerId,
        source: "sample",
        name: r === 3 ? "Long run" : r === 1 ? "Tempo / quality" : "Easy run",
        startDate: start,
        distanceM: Math.round(milesToMeters(mi)),
        movingTimeS,
        avgHr: hr,
        totalElevationM: Math.round(mi * 10),
        type: "Run",
      })
    }
  }

  return activities
}

function addDaysUTC(d: Date, n: number): Date {
  const c = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  c.setUTCDate(c.getUTCDate() + n)
  return c
}

function startOfIsoWeekUTC(d: Date): Date {
  const date = addDaysUTC(d, 0)
  const day = date.getUTCDay()
  const diff = (day === 0 ? -6 : 1) - day
  date.setUTCDate(date.getUTCDate() + diff)
  return date
}
