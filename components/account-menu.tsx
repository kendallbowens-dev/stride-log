"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

export function AccountMenu({ email, name }: { email: string; name?: string | null }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSignOut = async () => {
    setLoading(true)
    await authClient.signOut()
    router.push("/sign-in")
    router.refresh()
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted-foreground sm:inline" title={email}>
        {name || email}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSignOut}
        disabled={loading}
        className="gap-2 bg-transparent"
      >
        <LogOut className="size-4" />
        <span>{loading ? "Signing out..." : "Sign out"}</span>
      </Button>
    </div>
  )
}
