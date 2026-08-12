"use client"

import { useState, useTransition } from "react"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { generateRunningLog, syncLogToNotion } from "@/app/actions/log"
import { toast } from "sonner"

interface LogPanelProps {
  initialMarkdown: string | null
  initialSyncedAt: string | null
  notionConnected: boolean
  hasActivities: boolean
}

export function LogPanel({ initialMarkdown, initialSyncedAt, notionConnected, hasActivities }: LogPanelProps) {
  const [markdown, setMarkdown] = useState(initialMarkdown)
  const [syncedAt, setSyncedAt] = useState(initialSyncedAt)
  const [notice, setNotice] = useState<string | null>(null)
  const [isGenerating, startGenerate] = useTransition()
  const [isSyncing, startSync] = useTransition()

  function handleGenerate() {
    startGenerate(async () => {
      const res = await generateRunningLog()
      if (res.ok) {
        setMarkdown(res.markdown)
        setSyncedAt(null)
        setNotice(res.notice ?? null)
        toast.success(res.source === "ai" ? "Running log generated" : "Running log generated from training data")
      } else {
        toast.error(res.error)
      }
    })
  }

  function handleSync() {
    if (!notionConnected) {
      window.location.href = "/api/notion/authorize"
      return
    }
    startSync(async () => {
      const res = await syncLogToNotion()
      if (res.ok) {
        setSyncedAt(new Date().toISOString())
        toast.success("Synced to Notion", {
          action: { label: "Open", onClick: () => window.open(res.url, "_blank") },
        })
      } else {
        if ("needsAuth" in res && res.needsAuth) {
          window.location.href = "/api/notion/authorize"
          return
        }
        toast.error(res.error)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Training log agent</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating || !hasActivities}>
              {isGenerating ? "Analyzing..." : markdown ? "Regenerate" : "Generate log"}
            </Button>
            <Button size="sm" onClick={handleSync} disabled={isSyncing || !markdown}>
              {isSyncing ? "Syncing..." : notionConnected ? "Sync to Notion" : "Connect Notion"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {notionConnected
            ? syncedAt
              ? `Last synced to Notion ${new Date(syncedAt).toLocaleString()}`
              : "Notion connected — not yet synced"
            : "Connect Notion to publish this log to your workspace"}
        </p>
      </CardHeader>
      <CardContent>
        {markdown ? (
          <>
            {notice ? (
              <p className="mb-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                {notice}
              </p>
            ) : null}
            <Separator className="mb-4" />
            <article className="prose-log max-w-none">
              <ReactMarkdown>{markdown}</ReactMarkdown>
            </article>
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {hasActivities
              ? "Generate a narrative log with cut-back / ramp-up guidance based on your training data."
              : "Load some activities first, then generate your log."}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
