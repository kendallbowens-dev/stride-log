import { auth } from "@/lib/auth"
import { headers } from "next/headers"

// Every row is scoped by an owner id. With auth enabled this is the signed-in
// user's id. Throws when there is no session so callers never operate on
// another user's data.
export async function getOwnerId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

// Returns the owner id if signed in, otherwise null (for optional reads).
export async function getOwnerIdOrNull(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user?.id ?? null
}
