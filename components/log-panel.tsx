"use client"

import { useState, useTransition } from "react"
import ReactMarkdown from "react-markdown"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
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
  return out.trim()
}

export function LogPanel({ initialMarkdown, hasActivities }: LogPanelProps) {
  const [markdown, setMarkdown] = useState(initialMarkdown)
  const [notice, setNotice] = useState<string | null>(null)
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
          <CardTitle className="text-base">Training log agent</CardTitle>
          <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating || !hasActivities}>
            {isGenerating ? "Analyzing..." : markdown ? "Regenerate" : "Generate log"}
          </Button>
        </div>
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
              <ReactMarkdown>{stripRedundantSections(markdown)}</ReactMarkdown>
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
