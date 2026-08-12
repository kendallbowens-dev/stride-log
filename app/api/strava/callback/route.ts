import { exchangeCodeForToken, storeConnection, syncStravaActivities } from "@/lib/strava"
import { NextResponse, type NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  // Return to the same host the callback arrived on, so the flow stays on one domain.
  const origin = request.nextUrl.origin
  const code = request.nextUrl.searchParams.get("code")
  const error = request.nextUrl.searchParams.get("error")

  if (error || !code) {
    return NextResponse.redirect(`${origin}/?strava=denied`)
  }

  try {
    const token = await exchangeCodeForToken(code)
    await storeConnection(token)
    await syncStravaActivities()
    return NextResponse.redirect(`${origin}/?strava=connected`)
  } catch (err) {
    console.log("[v0] strava callback error:", err instanceof Error ? err.message : String(err))
    return NextResponse.redirect(`${origin}/?strava=error`)
  }
}
