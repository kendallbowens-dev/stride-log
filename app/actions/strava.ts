"use server"

import { db } from "@/lib/db"
import { activities, settings, settingsBackup, stravaConnection } from "@/lib/db/schema"
import { OWNER_ID } from "@/lib/owner"
import { getRedirectUri, stravaConfigured, syncStravaActivities } from "@/lib/strava"
import type { StravaStatus } from "@/lib/types"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getStravaStatus(): Promise<StravaStatus> {
  const configured = stravaConfigured()
  const rows = await db.select().from(stravaConnection).where(eq(stravaConnection.ownerId, OWNER_ID)).limit(1)
  const conn = rows[0]
  const redirectUri = await getRedirectUri()
  let callbackDomain = redirectUri
  try {
    callbackDomain = new URL(redirectUri).host
  } catch {
    // leave as-is if not a valid URL
  }
  return {
    configured,
    connected: Boolean(conn),
    athleteName: conn?.athleteName ?? null,
    lastSyncAt: conn?.lastSyncAt ? conn.lastSyncAt.toISOString() : null,
    redirectUri,
    callbackDomain,
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
  const currentSettings = await db.select().from(settings).where(eq(settings.ownerId, OWNER_ID)).limit(1)
  if (currentSettings[0]) {
    const { ownerId, ...rest } = currentSettings[0]
    await db
      .insert(settingsBackup)
      .values(currentSettings[0])
      .onConflictDoUpdate({ target: settingsBackup.ownerId, set: rest })
  }

  await db.delete(stravaConnection).where(eq(stravaConnection.ownerId, OWNER_ID))
  await db.delete(activities).where(and(eq(activities.ownerId, OWNER_ID), eq(activities.source, "strava")))
  await db.delete(settings).where(eq(settings.ownerId, OWNER_ID))
  revalidatePath("/")
  return { ok: true as const }
}
