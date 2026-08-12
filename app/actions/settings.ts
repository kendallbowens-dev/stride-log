"use server"

import { db } from "@/lib/db"
import { settings } from "@/lib/db/schema"
import { OWNER_ID } from "@/lib/owner"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getSettings() {
  const rows = await db.select().from(settings).where(eq(settings.ownerId, OWNER_ID)).limit(1)
  return rows[0] ?? null
}

export interface SettingsInput {
  injuryHistory?: string | null
  restingHr?: number | null
  targetRace?: string | null
  targetRaceDate?: string | null
  weeklyMileageGoalMi?: number | null
}

export async function saveSettings(input: SettingsInput) {
  const values = {
    ownerId: OWNER_ID,
    injuryHistory: input.injuryHistory ?? null,
    restingHr: input.restingHr ?? null,
    targetRace: input.targetRace ?? null,
    targetRaceDate: input.targetRaceDate ?? null,
    weeklyMileageGoalMi: input.weeklyMileageGoalMi ?? null,
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
        updatedAt: values.updatedAt,
      },
    })

  revalidatePath("/")
  return { ok: true }
}
