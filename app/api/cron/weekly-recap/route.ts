import { db } from "@/lib/db"
import { settings } from "@/lib/db/schema"
import { getAnalysis } from "@/lib/get-analysis"
import { buildRecapText } from "@/lib/sms/recap-text"
import { isTwilioConfigured, sendSms } from "@/lib/sms/twilio"
import { and, eq, isNotNull } from "drizzle-orm"
import { NextResponse } from "next/server"

// Runs on the Node runtime (needs Buffer + pg) and must never be cached.
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Weekly recap sender. Triggered by Vercel Cron every Monday (see vercel.json).
 * Authorized with CRON_SECRET as a Bearer token so only Vercel can invoke it.
 *
 * Iterates every user who opted in with a phone number, builds their recap from
 * the deterministic analysis, and texts it. Per-user failures are collected and
 * never abort the batch.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not set." }, { status: 500 })
  }
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  if (!isTwilioConfigured()) {
    return NextResponse.json({ ok: false, error: "Twilio is not configured." }, { status: 500 })
  }

  const recipients = await db
    .select()
    .from(settings)
    .where(and(eq(settings.smsRecapEnabled, true), isNotNull(settings.phoneNumber)))

  const results: { ownerId: string; ok: boolean; error?: string }[] = []

  for (const r of recipients) {
    const phone = r.phoneNumber
    if (!phone) continue
    try {
      const analysis = await getAnalysis(r.ownerId)
      const body = buildRecapText(analysis)
      const send = await sendSms(phone, body)
      if (send.ok) {
        await db.update(settings).set({ smsLastSentAt: new Date() }).where(eq(settings.ownerId, r.ownerId))
        results.push({ ownerId: r.ownerId, ok: true })
      } else {
        results.push({ ownerId: r.ownerId, ok: false, error: send.error })
      }
    } catch (err) {
      results.push({ ownerId: r.ownerId, ok: false, error: err instanceof Error ? err.message : "Unknown error" })
    }
  }

  const sent = results.filter((r) => r.ok).length
  return NextResponse.json({ ok: true, recipients: recipients.length, sent, results })
}
