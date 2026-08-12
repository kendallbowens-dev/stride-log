import "server-only"

import { db } from "@/lib/db"
import { activities, stravaConnection, type NewActivity } from "@/lib/db/schema"
import { OWNER_ID } from "@/lib/owner"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"

export function stravaConfigured(): boolean {
  return Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET)
}

export async function getOrigin(): Promise<string> {
  if (process.env.NODE_ENV !== "production" && process.env.V0_RUNTIME_URL) return process.env.V0_RUNTIME_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  return `${h.get("x-forwarded-proto") ?? "https"}://${host}`
}

export async function buildAuthorizeUrl(): Promise<string> {
  const origin = await getOrigin()
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    response_type: "code",
    redirect_uri: `${origin}/api/strava/callback`,
    approval_prompt: "auto",
    scope: "activity:read_all",
  })
  return `https://www.strava.com/oauth/authorize?${params.toString()}`
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_at: number // epoch seconds
  athlete?: { id: number; firstname?: string; lastname?: string }
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  })
  if (!res.ok) throw new Error(`Strava token exchange failed: ${res.status}`)
  return res.json()
}

export async function storeConnection(token: TokenResponse) {
  const athleteName = token.athlete
    ? `${token.athlete.firstname ?? ""} ${token.athlete.lastname ?? ""}`.trim()
    : null
  const values = {
    ownerId: OWNER_ID,
    athleteId: token.athlete ? String(token.athlete.id) : null,
    athleteName,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: new Date(token.expires_at * 1000),
  }
  await db
    .insert(stravaConnection)
    .values(values)
    .onConflictDoUpdate({
      target: stravaConnection.ownerId,
      set: {
        athleteId: values.athleteId,
        athleteName: values.athleteName,
        accessToken: values.accessToken,
        refreshToken: values.refreshToken,
        expiresAt: values.expiresAt,
      },
    })
}

async function getValidAccessToken(): Promise<string | null> {
  const rows = await db.select().from(stravaConnection).where(eq(stravaConnection.ownerId, OWNER_ID)).limit(1)
  const conn = rows[0]
  if (!conn) return null

  // refresh if within 5 minutes of expiry
  if (conn.expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
    return conn.accessToken
  }

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: conn.refreshToken,
    }),
  })
  if (!res.ok) return null
  const token: TokenResponse = await res.json()
  await db
    .update(stravaConnection)
    .set({
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(token.expires_at * 1000),
    })
    .where(eq(stravaConnection.ownerId, OWNER_ID))
  return token.access_token
}

interface StravaActivity {
  id: number
  name: string
  distance: number // meters
  moving_time: number // seconds
  type: string
  sport_type: string
  start_date: string
  average_heartrate?: number
  total_elevation_gain?: number
}

/**
 * Pulls the athlete's runs from Strava (last ~180 days) and upserts them.
 * Returns the number of run activities imported.
 */
export async function syncStravaActivities(): Promise<{ imported: number }> {
  const accessToken = await getValidAccessToken()
  if (!accessToken) throw new Error("No valid Strava connection")

  const after = Math.floor((Date.now() - 180 * 24 * 3600 * 1000) / 1000)
  const perPage = 200
  const collected: StravaActivity[] = []

  for (let page = 1; page <= 5; page++) {
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=${perPage}&page=${page}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!res.ok) throw new Error(`Strava activities fetch failed: ${res.status}`)
    const batch: StravaActivity[] = await res.json()
    collected.push(...batch)
    if (batch.length < perPage) break
  }

  const runs = collected.filter((a) => a.type === "Run" || a.sport_type === "Run" || a.sport_type === "TrailRun")

  const toInsert: NewActivity[] = runs.map((a) => ({
    id: `strava-${a.id}`,
    ownerId: OWNER_ID,
    source: "strava",
    name: a.name,
    startDate: new Date(a.start_date),
    distanceM: Math.round(a.distance),
    movingTimeS: a.moving_time,
    avgHr: a.average_heartrate ?? null,
    totalElevationM: a.total_elevation_gain ?? 0,
    type: "Run",
  }))

  if (toInsert.length > 0) {
    // upsert one by one to refresh existing rows
    for (const row of toInsert) {
      await db
        .insert(activities)
        .values(row)
        .onConflictDoUpdate({
          target: activities.id,
          set: {
            name: row.name,
            distanceM: row.distanceM,
            movingTimeS: row.movingTimeS,
            avgHr: row.avgHr,
            totalElevationM: row.totalElevationM,
          },
        })
    }
  }

  await db.update(stravaConnection).set({ lastSyncAt: new Date() }).where(eq(stravaConnection.ownerId, OWNER_ID))

  return { imported: toInsert.length }
}
