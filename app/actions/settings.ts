"use server"

import { db } from "@/lib/db"
import { settings } from "@/lib/db/schema"
import { getOwnerId } from "@/lib/owner"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getSettings() {
  const ownerId = await getOwnerId()
  const rows = await db.select().from(settings).where(eq(settings.ownerId, ownerId)).limit(1)
  return rows[0] ?? null
}

export interface SettingsInput {
  injuryHistory?: string | null
  restingHr?: number | null
  targetRace?: string | null
  targetRaceDate?: string | null
  weeklyMileageGoalMi?: number | null
  phoneNumber?: string | null
  smsRecapEnabled?: boolean
}

/**
 * Best-effort E.164 normalization. Keeps a leading "+", strips other
 * non-digits, and assumes a US country code for bare 10-digit numbers.
 * Returns null for empty/too-short input so we never store junk.
 */
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const hadPlus = trimmed.startsWith("+")
  const digits = trimmed.replace(/\D/g, "")
  if (digits.length < 10) return null
  if (hadPlus) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  return `+${digits}`
}

export async function saveSettings(input: SettingsInput) {
  const ownerId = await getOwnerId()
  const phoneNumber = normalizePhone(input.phoneNumber)
  // Can't enable recaps without a valid destination number.
  const smsRecapEnabled = Boolean(input.smsRecapEnabled) && phoneNumber !== null
  const values = {
    ownerId,
    injuryHistory: input.injuryHistory ?? null,
    restingHr: input.restingHr ?? null,
    targetRace: input.targetRace ?? null,
    targetRaceDate: input.targetRaceDate ?? null,
    weeklyMileageGoalMi: input.weeklyMileageGoalMi ?? null,
    phoneNumber,
    smsRecapEnabled,
    updatedAt: new Date(),
  }

  await db
    .insert(settings)
    .values(values)
    .onConflictDoUpdate({
      target: settings.ownerId,
      set: {
        injuryHistory: values.injuryHistory,
        restingHr: values.restingHr,
        targetRace: values.targetRace,
        targetRaceDate: values.targetRaceDate,
        weeklyMileageGoalMi: values.weeklyMileageGoalMi,
        phoneNumber: values.phoneNumber,
        smsRecapEnabled: values.smsRecapEnabled,
        updatedAt: values.updatedAt,
      },
    })

  revalidatePath("/")
  return { ok: true, smsRecapEnabled, phoneSaved: phoneNumber !== null }
}
