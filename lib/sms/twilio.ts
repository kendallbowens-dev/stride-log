import "server-only"

export interface SendSmsResult {
  ok: boolean
  /** Twilio message SID on success. */
  sid?: string
  /** Human-readable error when ok is false. */
  error?: string
  /** True when the failure is a missing-config problem rather than a send error. */
  notConfigured?: boolean
}

/** Whether all Twilio env vars are present. */
export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER,
  )
}

/**
 * Sends an SMS via the Twilio REST API. No SDK dependency — a single
 * form-encoded POST with basic auth. Fails safe: returns a result object
 * rather than throwing, so a bad number for one user never aborts a batch.
 */
export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !from) {
    return { ok: false, notConfigured: true, error: "Twilio env vars are not set." }
  }

  const params = new URLSearchParams({ To: to, From: from, Body: body })
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64")

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      return { ok: false, error: `Twilio ${res.status}: ${detail.slice(0, 200)}` }
    }

    const json = (await res.json()) as { sid?: string }
    return { ok: true, sid: json.sid }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown send error" }
  }
}
