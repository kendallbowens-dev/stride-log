import { auth } from "@/lib/auth"
import { exchangeCodeForToken, storeConnection, syncStravaActivities } from "@/lib/strava"
import { headers } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  // Return to the same host the callback arrived on, so the flow stays on one domain.
  const origin = request.nextUrl.origin
  const code = request.nextUrl.searchParams.get("code")
  const error = request.nextUrl.searchParams.get("error")

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.redirect(`${origin}/sign-in`)
  }
  const ownerId = session.user.id

  if (error || !code) {
    return NextResponse.redirect(`${origin}/?strava=denied`)
  }

  try {
    const token = await exchangeCodeForToken(code)
    await storeConnection(ownerId, token)
    await syncStravaActivities(ownerId)
    return NextResponse.redirect(`${origin}/?strava=connected`)
  } catch (err) {
    console.log("[v0] strava callback error:", err instanceof Error ? err.message : String(err))
    return NextResponse.redirect(`${origin}/?strava=error`)
  }
}
