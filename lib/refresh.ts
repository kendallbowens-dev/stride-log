import "server-only"

import { db } from "@/lib/db"
import { activities, stravaConnection } from "@/lib/db/schema"
import { syncStravaActivities } from "@/lib/strava"
import { generateLogForOwner, getLatestLogForOwner } from "@/lib/training-log"
import { eq, sql } from "drizzle-orm"

/** How old the last Strava sync can be before opening the app triggers a refresh. */
export const AUTO_SYNC_STALE_MS = 30 * 60 * 1000

export interface RefreshResult {
  imported: number
  dataChanged: boolean
  logUpdated: boolean
}

// A cheap signature of the owner's activity set, used to detect whether a sync
// actually brought in new or edited activities before paying for a new log.
async function activityFingerprint(ownerId: string): Promise<string> {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      latest: sql<string | null>`max(${activities.startDate})::text`,
      totalTime: sql<number>`coalesce(sum(${activities.movingTimeS}), 0)::int`,
      totalDistance: sql<number>`coalesce(round(sum(${activities.distanceM})), 0)::int`,
    })
    .from(activities)
    .where(eq(activities.ownerId, ownerId))
  return `${row?.count}|${row?.latest}|${row?.totalTime}|${row?.totalDistance}`
}

export async function getLastSyncAt(ownerId: string): Promise<Date | null | undefined> {
  const rows = await db
    .select({ lastSyncAt: stravaConnection.lastSyncAt })
    .from(stravaConnection)
    .where(eq(stravaConnection.ownerId, ownerId))
    .limit(1)
  // undefined = not connected; null = connected but never synced
  return rows.length ? rows[0].lastSyncAt : undefined
}

/**
 * Pulls fresh Strava data for one owner and regenerates the training log when
 * the data changed (or no log exists yet). Session-independent so both the
 * cron job and the signed-in auto-refresh can use it.
 */
export async function refreshOwner(ownerId: string): Promise<RefreshResult> {
  const before = await activityFingerprint(ownerId)
  const { imported } = await syncStravaActivities(ownerId)
  const after = await activityFingerprint(ownerId)
  const dataChanged = before !== after

  const existingLog = await getLatestLogForOwner(ownerId)
  let logUpdated = false
  if (dataChanged || !existingLog) {
    const log = await generateLogForOwner(ownerId)
    logUpdated = log.ok
  }

  return { imported, dataChanged, logUpdated }
}
