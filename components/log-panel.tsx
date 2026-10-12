"use client"

import { useState, useTransition, type FormEvent, type KeyboardEvent } from "react"
import ReactMarkdown from "react-markdown"
import { ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { askCoach, generateRunningLog } from "@/app/actions/log"
import { toast } from "sonner"

type ChatMessage = { role: "user" | "assistant"; content: string }

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
  const [thread, setThread] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState("")
  // Pick up logs regenerated in the background (auto-refresh / cron) after a router refresh.
  const [prevInitial, setPrevInitial] = useState(initialMarkdown)
  if (initialMarkdown !== prevInitial) {
    setPrevInitial(initialMarkdown)
    setMarkdown(initialMarkdown)
    setNotice(null)
    setThread([])
  }
  const [isGenerating, startGenerate] = useTransition()
  const [isReplying, startReply] = useTransition()

  function sendReply() {
    const content = draft.trim()
    if (!content || isReplying) return
    const next: ChatMessage[] = [...thread, { role: "user", content }]
    setThread(next)
    setDraft("")
    startReply(async () => {
      const res = await askCoach({ coachNote: markdown, messages: next.slice(-20) })
      if (res.ok) {
        setThread([...next, { role: "assistant", content: res.reply }])
      } else {
        setThread(thread)
        setDraft(content)
        toast.error(res.error)
      }
    })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    sendReply()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey) return
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    sendReply()
  }

  function handleGenerate() {
    startGenerate(async () => {
      const res = await generateRunningLog()
      if (res.ok) {
        setThread([])
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

            {thread.length > 0 || isReplying ? (
              <ul className="mt-3 flex flex-col gap-2" aria-live="polite" aria-label="Conversation with your coach">
                {thread.map((msg, i) => (
                  <li
                    key={i}
                    className={
                      msg.role === "user"
                        ? "max-w-[85%] self-end rounded-2xl rounded-tr-sm bg-primary px-4 py-2 text-pretty text-sm leading-relaxed text-primary-foreground"
                        : "max-w-[85%] self-start rounded-2xl rounded-tl-sm bg-secondary px-4 py-2 text-pretty text-sm leading-relaxed text-secondary-foreground [&_p+p]:mt-2"
                    }
                  >
                    <span className="sr-only">{msg.role === "user" ? "You: " : "Coach: "}</span>
                    {msg.role === "user" ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
                  </li>
                ))}
                {isReplying ? (
                  <li className="self-start rounded-2xl rounded-tl-sm bg-secondary px-4 py-2 text-sm text-muted-foreground">
                    Coach is typing...
                  </li>
                ) : null}
              </ul>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-3 flex items-end gap-2">
              <label htmlFor="coach-reply" className="sr-only">
                Reply to your coach
              </label>
              <Textarea
                id="coach-reply"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your coach a question..."
                rows={1}
                maxLength={1000}
                className="max-h-32 min-h-10 resize-none rounded-2xl"
              />
              <Button
                type="submit"
                size="icon"
                className="shrink-0 rounded-full"
                disabled={!draft.trim() || isReplying}
                aria-label="Send reply"
              >
                <ArrowUp className="size-4" aria-hidden="true" />
              </Button>
            </form>
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
