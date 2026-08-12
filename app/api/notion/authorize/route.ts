import { NextResponse } from "next/server"
import { startNotionAuthorization } from "@/lib/notion"

export async function GET(request: Request) {
  const origin = new URL(request.url).origin
  const callbackUrl = `${origin}/api/notion/callback`
  const url = await startNotionAuthorization(callbackUrl)
  return NextResponse.redirect(url)
}
