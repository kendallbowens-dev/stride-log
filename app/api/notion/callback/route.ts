import { NextResponse } from "next/server"

// Vercel Connect completes the OAuth token exchange server-side and redirects
// here. We just send the owner back to the dashboard with a success marker.
export async function GET(request: Request) {
  const origin = new URL(request.url).origin
  return NextResponse.redirect(`${origin}/?notion=connected`)
}
