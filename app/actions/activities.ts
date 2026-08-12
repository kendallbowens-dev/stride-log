"use server"

import { db } from "@/lib/db"
import { activities, type NewActivity } from "@/lib/db/schema"
import { OWNER_ID } from "@/lib/owner"
import { generateSampleActivities } from "@/lib/sample-data"
import { milesToMeters } from "@/lib/units"
import { and, desc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getActivities() {
  return db
    .select()
    .from(activities)
    .where(eq(activities.ownerId, OWNER_ID))
    .orderBy(desc(activities.startDate))
}

export async function seedSampleData() {
  const sample = generateSampleActivities()
  // clear existing sample rows first so re-seeding is idempotent
  await db.delete(activities).where(and(eq(activities.ownerId, OWNER_ID), eq(activities.source, "sample")))
  await db.insert(activities).values(sample).onConflictDoNothing()
  revalidatePath("/")
  return { inserted: sample.length }
}

export async function clearActivities() {
  await db.delete(activities).where(eq(activities.ownerId, OWNER_ID))
  revalidatePath("/")
}

/**
 * Import activities from a parsed CSV. Expected columns (case-insensitive):
 * date, distance_mi (or distance_km / distance_m), duration (mm:ss or seconds), avg_hr?, name?
 * A bare "distance" column is interpreted as miles.
 */
export async function importActivities(rows: Record<string, string>[]) {
  const toInsert: NewActivity[] = []
  let skipped = 0

  for (let i = 0; i < rows.length; i++) {
    const row = normalizeKeys(rows[i])
    const dateRaw = row["date"] ?? row["start_date"] ?? row["start date"]
    if (!dateRaw) {
      skipped++
      continue
    }
    const start = new Date(dateRaw)
    if (isNaN(start.getTime())) {
      skipped++
      continue
    }

    let distanceM: number | null = null
    if (row["distance_m"]) distanceM = Number(row["distance_m"])
    else if (row["distance_mi"]) distanceM = milesToMeters(Number(row["distance_mi"]))
    else if (row["distance_miles"]) distanceM = milesToMeters(Number(row["distance_miles"]))
    else if (row["distance_km"]) distanceM = Number(row["distance_km"]) * 1000
    else if (row["distance"]) distanceM = milesToMeters(Number(row["distance"]))
    if (!distanceM || isNaN(distanceM) || distanceM <= 0) {
      skipped++
      continue
    }

    const durRaw = row["duration"] ?? row["moving_time"] ?? row["time"]
    const movingTimeS = parseDuration(durRaw)
    if (!movingTimeS) {
      skipped++
      continue
    }

    const hrRaw = row["avg_hr"] ?? row["heart_rate"] ?? row["hr"]
    const avgHr = hrRaw ? Number(hrRaw) : null

    toInsert.push({
      id: `csv-${start.getTime()}-${i}`,
      ownerId: OWNER_ID,
      source: "csv",
      name: row["name"] ?? row["title"] ?? "Imported run",
      startDate: start,
      distanceM: Math.round(distanceM),
      movingTimeS,
      avgHr: avgHr && !isNaN(avgHr) ? avgHr : null,
      totalElevationM: row["elevation"] ? Number(row["elevation"]) : 0,
      type: "Run",
    })
  }

  if (toInsert.length > 0) {
    await db.insert(activities).values(toInsert).onConflictDoNothing()
    revalidatePath("/")
  }

  return { inserted: toInsert.length, skipped }
}

function normalizeKeys(row: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(row)) {
    out[k.trim().toLowerCase()] = typeof v === "string" ? v.trim() : v
  }
  return out
}

function parseDuration(raw?: string): number | null {
  if (!raw) return null
  if (/^\d+$/.test(raw)) return Number(raw) // plain seconds
  const parts = raw.split(":").map(Number)
  if (parts.some(isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}
