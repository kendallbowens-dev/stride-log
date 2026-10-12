"use server"

import { getOwnerId } from "@/lib/owner"
import {
  generateLogForOwner,
  getLatestLogForOwner,
  replyToCoachForOwner,
  type CoachReplyResult,
} from "@/lib/training-log"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const askCoachSchema = z.object({
  coachNote: z.string().max(4000).nullable(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(1000),
      }),
    )
    .min(1)
    .max(20)
    .refine((msgs) => msgs[msgs.length - 1].role === "user", "Last message must be from the athlete"),
})

export async function askCoach(input: z.input<typeof askCoachSchema>): Promise<CoachReplyResult> {
  const ownerId = await getOwnerId()
  const parsed = askCoachSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Keep your message under 1,000 characters." }
  return replyToCoachForOwner(ownerId, parsed.data.coachNote, parsed.data.messages)
}

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
