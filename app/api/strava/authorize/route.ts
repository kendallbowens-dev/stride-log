import { buildAuthorizeUrl, stravaConfigured } from "@/lib/strava"
import { NextResponse } from "next/server"

export async function GET() {
  if (!stravaConfigured()) {
    return NextResponse.json(
      { error: "Strava is not configured. Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET." },
      { status: 400 },
    )
  }
  const url = await buildAuthorizeUrl()
  return NextResponse.redirect(url)
}
