import { auth } from "@/lib/auth"
import { AuthForm } from "@/components/auth-form"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function SignUpPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect("/")
  return <AuthForm mode="sign-up" />
}
