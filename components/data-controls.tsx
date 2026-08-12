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

export function DataControls({ strava, activityCount }: { strava: StravaStatus; activityCount: number }) {
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
                {strava.lastSyncAt ? ` · last sync ${new Date(strava.lastSyncAt).toLocaleDateString()}` : ""}
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
            <div className="flex flex-col gap-3">
              <a href="/api/strava/authorize" className={cn(buttonVariants({ size: "sm" }), "w-fit")}>
                <Activity className="size-4" />
                Connect Strava
              </a>
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                <p className="mb-2 font-medium text-foreground">Getting a 400 / redirect_uri invalid?</p>
                <p className="text-muted-foreground text-pretty">
                  In your{" "}
                  <a
                    href="https://www.strava.com/settings/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    Strava API settings
                  </a>
                  , set <span className="font-medium text-foreground">Authorization Callback Domain</span> to exactly
                  this (bare domain, no https, no path):
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(strava.callbackDomain)
                    toast.success("Callback domain copied")
                  }}
                  className="mt-2 block w-full truncate rounded bg-background px-2 py-1.5 text-left font-mono text-foreground ring-1 ring-border hover:ring-primary"
                  title="Click to copy"
                >
                  {strava.callbackDomain}
                </button>
                <p className="mt-2 text-muted-foreground">
                  Full redirect the app sends: <span className="break-all font-mono">{strava.redirectUri}</span>. Start
                  the connect flow from this same domain.
                </p>
              </div>
            </div>
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
          {activityCount > 0 && (
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
