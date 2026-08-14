"use client"

import { clearActivities, importActivities, seedSampleData } from "@/app/actions/activities"
import { disconnectStrava, syncStrava } from "@/app/actions/strava"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { parseCsv } from "@/lib/csv"
import type { StravaStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Activity, Database, RefreshCw, Trash2, Upload } from "lucide-react"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"

function formatSyncDate(value: string | number | Date) {
  const d = new Date(value)
  // Format in UTC so the server and client render an identical string (avoids hydration mismatch).
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`
}

export function DataControls({
  strava,
  activityCount,
  totalCount,
}: {
  strava: StravaStatus
  activityCount: number
  totalCount: number
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [busy, setBusy] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function run(label: string, fn: () => Promise<void>) {
    setBusy(label)
    startTransition(async () => {
      try {
        await fn()
      } finally {
        setBusy(null)
        router.refresh()
      }
    })
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const rows = parseCsv(text)
    if (rows.length === 0) {
      toast.error("Could not parse any rows from that CSV.")
      return
    }
    run("import", async () => {
      const res = await importActivities(rows)
      toast.success(`Imported ${res.inserted} runs${res.skipped ? `, skipped ${res.skipped}` : ""}.`)
    })
    if (fileRef.current) fileRef.current.value = ""
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Data sources</CardTitle>
        <CardDescription>
          {activityCount > 0 ? `${activityCount} runs loaded.` : "No runs loaded yet."} Connect Strava (where Runna
          syncs your runs), import a CSV, or load sample data to explore.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Activity className="size-4 text-primary" />
            Strava
          </div>
          {!strava.configured ? (
            <p className="text-sm text-muted-foreground text-pretty">
              Strava isn&apos;t configured yet. Add your <code className="text-xs">STRAVA_CLIENT_ID</code> and{" "}
              <code className="text-xs">STRAVA_CLIENT_SECRET</code> in project settings to enable automatic sync.
            </p>
          ) : strava.connected ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Connected{strava.athleteName ? ` as ${strava.athleteName}` : ""}
                  {strava.lastSyncAt ? ` · last sync ${formatSyncDate(strava.lastSyncAt)}` : ""}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    run("sync", async () => {
                      const res = await syncStrava()
                      if (res.ok) toast.success(`Synced ${res.imported} runs from Strava.`)
                      else toast.error(res.error)
                    })
                  }
                  disabled={isPending}
                >
                  <RefreshCw className={busy === "sync" ? "size-4 animate-spin" : "size-4"} />
                  Sync now
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => run("disconnect", async () => void (await disconnectStrava()))}
                  disabled={isPending}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <a href="/api/strava/authorize" className={cn(buttonVariants({ size: "sm" }), "w-fit")}>
              <Activity className="size-4" />
              Connect Strava
            </a>
          )}
        </div>

        <Separator />

        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv" onChange={onFile} className="hidden" />
          <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={isPending}>
            <Upload className="size-4" />
            Import CSV
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              run("seed", async () => {
                const res = await seedSampleData()
                toast.success(`Loaded ${res.inserted} sample runs.`)
              })
            }
            disabled={isPending}
          >
            <Database className={busy === "seed" ? "size-4 animate-spin" : "size-4"} />
            Load sample data
          </Button>
          {totalCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-danger"
              onClick={() =>
                run("clear", async () => {
                  await clearActivities()
                  toast.success("Cleared all activities.")
                })
              }
              disabled={isPending}
            >
              <Trash2 className="size-4" />
              Clear
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground text-pretty">
          CSV columns: <code>date</code>, <code>distance_mi</code> (or <code>distance_km</code>/<code>distance_m</code>),{" "}
          <code>duration</code> (mm:ss), optional <code>avg_hr</code> and <code>name</code>.
        </p>
      </CardContent>
    </Card>
  )
}
