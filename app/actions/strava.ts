"use server"

import { db } from "@/lib/db"
import { activities, settings, settingsBackup, stravaConnection } from "@/lib/db/schema"
import { getOwnerId } from "@/lib/owner"
import { AUTO_SYNC_STALE_MS, getLastSyncAt, refreshOwner } from "@/lib/refresh"
import { getRedirectUri, stravaConfigured } from "@/lib/strava"
import type { StravaStatus } from "@/lib/types"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getStravaStatus(): Promise<StravaStatus> {
  const ownerId = await getOwnerId()
  const configured = stravaConfigured()
  const rows = await db.select().from(stravaConnection).where(eq(stravaConnection.ownerId, ownerId)).limit(1)
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
    const ownerId = await getOwnerId()
    const { imported } = await refreshOwner(ownerId)
    revalidatePath("/")
    return { ok: true as const, imported }
  } catch (err) {
    console.log("[v0] strava sync error:", err instanceof Error ? err.message : String(err))
    return { ok: false as const, error: "Strava sync failed. Reconnect and try again." }
  }
}

/**
 * Called when the dashboard opens. Re-syncs Strava and regenerates the
 * training log only if the last sync is stale, so repeated opens stay cheap.
 */
export async function autoRefresh(): Promise<{ refreshed: boolean; changed: boolean }> {
  const ownerId = await getOwnerId()
  if (!stravaConfigured()) return { refreshed: false, changed: false }

  const lastSyncAt = await getLastSyncAt(ownerId)
  if (lastSyncAt === undefined) return { refreshed: false, changed: false }
  if (lastSyncAt && Date.now() - lastSyncAt.getTime() < AUTO_SYNC_STALE_MS) {
    return { refreshed: false, changed: false }
  }

  try {
    const result = await refreshOwner(ownerId)
    revalidatePath("/")
    return { refreshed: true, changed: result.dataChanged || result.logUpdated }
  } catch (err) {
    console.log("[v0] auto refresh error:", err instanceof Error ? err.message : String(err))
    return { refreshed: false, changed: false }
  }
}

export async function disconnectStrava() {
  const ownerId = await getOwnerId()
  const currentSettings = await db.select().from(settings).where(eq(settings.ownerId, ownerId)).limit(1)
  if (currentSettings[0]) {
    const { ownerId: _ownerId, ...rest } = currentSettings[0]
    await db
      .insert(settingsBackup)
      .values(currentSettings[0])
      .onConflictDoUpdate({ target: settingsBackup.ownerId, set: rest })
  }

  await db.delete(stravaConnection).where(eq(stravaConnection.ownerId, ownerId))
  await db.delete(activities).where(and(eq(activities.ownerId, ownerId), eq(activities.source, "strava")))
  await db.delete(settings).where(eq(settings.ownerId, ownerId))
  revalidatePath("/")
  return { ok: true as const }
}
