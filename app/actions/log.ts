"use server"

import { getOwnerId } from "@/lib/owner"
import { generateLogForOwner, getLatestLogForOwner } from "@/lib/training-log"
import { revalidatePath } from "next/cache"

export async function generateRunningLog() {
  const ownerId = await getOwnerId()
  const result = await generateLogForOwner(ownerId)
  if (result.ok) revalidatePath("/")
  return result
}

export async function getLatestLog() {
  const ownerId = await getOwnerId()
  return getLatestLogForOwner(ownerId)
}
