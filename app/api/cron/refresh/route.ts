import { db } from "@/lib/db"
import { stravaConnection } from "@/lib/db/schema"
import { refreshOwner } from "@/lib/refresh"
import { stravaConfigured } from "@/lib/strava"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300

/**
 * Daily background refresh (see vercel.json): re-syncs every connected Strava
 * account and regenerates the training log for anyone whose data changed.
 * Runs before the Monday SMS recap so texts use fresh data.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not set." }, { status: 500 })
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }
  if (!stravaConfigured()) {
    return NextResponse.json({ ok: false, error: "Strava is not configured." }, { status: 500 })
  }

  const connections = await db.select({ ownerId: stravaConnection.ownerId }).from(stravaConnection)
  const results: { ownerId: string; ok: boolean; logUpdated?: boolean; error?: string }[] = []

  for (const { ownerId } of connections) {
    try {
      const r = await refreshOwner(ownerId)
      results.push({ ownerId, ok: true, logUpdated: r.logUpdated })
    } catch (err) {
      results.push({ ownerId, ok: false, error: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  return NextResponse.json({
    ok: true,
    accounts: connections.length,
    refreshed: results.filter((r) => r.ok).length,
    logsUpdated: results.filter((r) => r.logUpdated).length,
    results,
  })
}
