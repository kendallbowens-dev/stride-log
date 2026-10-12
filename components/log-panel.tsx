"use client"

import { useState, useTransition } from "react"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { generateRunningLog } from "@/app/actions/log"
import { toast } from "sonner"

interface LogPanelProps {
  initialMarkdown: string | null
  hasActivities: boolean
}

// The current-week tiles and the weekly timeline table already show this data,
// so drop these sections from the narrative — including from older saved logs
// that were generated before they were removed from the generator.
const REDUNDANT_SECTIONS = ["This Week's Call", "Weekly Log"]

function stripRedundantSections(md: string): string {
  let out = md
  for (const heading of REDUNDANT_SECTIONS) {
    // Remove a "## Heading" block up to the next "## " heading or end of doc.
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const re = new RegExp(`\\n?##\\s+${escaped}[\\s\\S]*?(?=\\n##\\s|$)`, "g")
    out = out.replace(re, "")
  }
  // Drop the top-level "# Running Log — <date range>" title (redundant with
  // the panel's own "Training log agent" header).
  out = out.replace(/^#\s+Running Log[^\n]*\n?/m, "")
  return out.trim()
}

export function LogPanel({ initialMarkdown, hasActivities }: LogPanelProps) {
  const [markdown, setMarkdown] = useState(initialMarkdown)
  const [notice, setNotice] = useState<string | null>(null)
  // Pick up logs regenerated in the background (auto-refresh / cron) after a router refresh.
  const [prevInitial, setPrevInitial] = useState(initialMarkdown)
  if (initialMarkdown !== prevInitial) {
    setPrevInitial(initialMarkdown)
    setMarkdown(initialMarkdown)
    setNotice(null)
  }
  const [isGenerating, startGenerate] = useTransition()

  function handleGenerate() {
    startGenerate(async () => {
      const res = await generateRunningLog()
      if (res.ok) {
        setMarkdown(res.markdown)
        setNotice(res.notice ?? null)
        toast.success(res.source === "ai" ? "Running log generated" : "Running log generated from training data")
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">From your coach</CardTitle>
          <Button variant="ghost" size="sm" onClick={handleGenerate} disabled={isGenerating || !hasActivities}>
            {isGenerating ? "Thinking..." : markdown ? "New take" : "Check in"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {markdown ? (
          <>
            {notice ? (
              <p className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                {notice}
              </p>
            ) : null}
            <div className="rounded-2xl rounded-tl-sm bg-secondary px-4 py-3 text-pretty text-sm leading-relaxed text-secondary-foreground [&_p+p]:mt-2">
              <ReactMarkdown>{stripRedundantSections(markdown)}</ReactMarkdown>
            </div>
          </>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {hasActivities
              ? "Check in for a quick note on how your training is going."
              : "Load some activities first, then check in with your coach."}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
