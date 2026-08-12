"use server"

import { db } from "@/lib/db"
import { stravaConnection } from "@/lib/db/schema"
import { OWNER_ID } from "@/lib/owner"
import { stravaConfigured, syncStravaActivities } from "@/lib/strava"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getStravaStatus() {
  const configured = stravaConfigured()
  const rows = await db.select().from(stravaConnection).where(eq(stravaConnection.ownerId, OWNER_ID)).limit(1)
  const conn = rows[0]
  return {
    configured,
    connected: Boolean(conn),
    athleteName: conn?.athleteName ?? null,
    lastSyncAt: conn?.lastSyncAt ? conn.lastSyncAt.toISOString() : null,
  }
}

export async function syncStrava() {
  try {
    const { imported } = await syncStravaActivities()
    revalidatePath("/")
    return { ok: true as const, imported }
  } catch (err) {
    console.log("[v0] strava sync error:", err instanceof Error ? err.message : String(err))
    return { ok: false as const, error: "Strava sync failed. Reconnect and try again." }
  }
}

export async function disconnectStrava() {
  await db.delete(stravaConnection).where(eq(stravaConnection.ownerId, OWNER_ID))
  revalidatePath("/")
  return { ok: true as const }
}
