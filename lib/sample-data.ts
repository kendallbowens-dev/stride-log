import type { NewActivity } from "@/lib/db/schema"
import { OWNER_ID } from "@/lib/owner"

/**
 * Generates a realistic ~14-week marathon-style build for demo/testing:
 *   - a steady base
 *   - a progressive build
 *   - a deliberate overload spike (should trigger a mileage cut-back flag)
 *   - a down/taper week (should trigger ramp-up headroom)
 * Paces drift faster over the block, with a fatigue bump during the spike so
 * the pace + HR analysis has something to detect.
 */
export function generateSampleActivities(): NewActivity[] {
  // target weekly km per week (index 0 = oldest)
  const weeklyKm = [38, 40, 42, 39, 45, 48, 44, 52, 58, 70, 45, 55, 60, 42]
  // base easy pace sec/km, improving over time (lower = faster)
  const basePace = [335, 333, 332, 330, 329, 327, 326, 324, 323, 330, 320, 318, 317, 322]
  // resting-ish HR cost; bumps during the overload spike (week index 9)
  const baseHr = [148, 147, 147, 146, 146, 145, 145, 144, 144, 156, 143, 142, 142, 145]

  const runsPerWeek = 4
  const now = new Date()
  const totalWeeks = weeklyKm.length
  const activities: NewActivity[] = []

  // Monday of the oldest week
  const firstMonday = startOfIsoWeekUTC(addDaysUTC(now, -7 * (totalWeeks - 1)))

  for (let w = 0; w < totalWeeks; w++) {
    const weekStart = addDaysUTC(firstMonday, w * 7)
    const totalKm = weeklyKm[w]
    // distribute: one long run (~40%) + shorter runs
    const longRunKm = totalKm * 0.4
    const rest = totalKm - longRunKm
    const shortKm = rest / (runsPerWeek - 1)

    // run days: Tue, Wed, Fri, Sun(long)
    const dayOffsets = [1, 2, 4, 6]
    const kms = [shortKm, shortKm, shortKm, longRunKm]

    for (let r = 0; r < runsPerWeek; r++) {
      const km = kms[r]
      if (km <= 0) continue
      const day = addDaysUTC(weekStart, dayOffsets[r])
      // long run a bit slower, quality (Wed) a bit faster
      let pace = basePace[w]
      if (r === 3) pace += 18 // long run slower
      if (r === 1) pace -= 15 // midweek quality faster
      // small deterministic-ish jitter
      pace += ((w * 7 + r) % 5) - 2

      const movingTimeS = Math.round(km * pace)
      const hr = baseHr[w] + (r === 1 ? 8 : 0) + (r === 3 ? 3 : 0)

      // set the run time to mid-morning
      const start = new Date(day)
      start.setUTCHours(8, 0, 0, 0)

      activities.push({
        id: `sample-${w}-${r}`,
        ownerId: OWNER_ID,
        source: "sample",
        name: r === 3 ? "Long run" : r === 1 ? "Tempo / quality" : "Easy run",
        startDate: start,
        distanceM: Math.round(km * 1000),
        movingTimeS,
        avgHr: hr,
        totalElevationM: Math.round(km * 6),
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
