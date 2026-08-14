import { auth } from "@/lib/auth"
import { buildAuthorizeUrl, stravaConfigured } from "@/lib/strava"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.redirect(new URL("/sign-in", process.env.BETTER_AUTH_URL ?? "http://localhost:3000"))
  }
  if (!stravaConfigured()) {
    return NextResponse.json(
      { error: "Strava is not configured. Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET." },
      { status: 400 },
    )
  }
  const url = await buildAuthorizeUrl()
  return NextResponse.redirect(url)
}
