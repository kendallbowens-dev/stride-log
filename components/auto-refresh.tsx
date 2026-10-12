"use client"

import { autoRefresh } from "@/app/actions/strava"
import { RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import useSWR from "swr"

/**
 * Refreshes Strava data and the training log in the background when the
 * dashboard opens or regains focus. The server decides whether the last sync
 * is stale, so this is a no-op most of the time.
 */
export function AutoRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter()
  const { isValidating } = useSWR(enabled ? "strava-auto-refresh" : null, () => autoRefresh(), {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    focusThrottleInterval: 5 * 60 * 1000,
    dedupingInterval: 60 * 1000,
    shouldRetryOnError: false,
    onSuccess: (result) => {
      if (result.changed) router.refresh()
    },
  })

  return (
    <span role="status" aria-live="polite" className="flex items-center">
      {isValidating ? (
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          <RefreshCw className="size-3 animate-spin" aria-hidden="true" />
          Syncing
        </span>
      ) : null}
    </span>
  )
}
