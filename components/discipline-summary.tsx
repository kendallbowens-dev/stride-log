"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { FlagBadge, severityDot } from "@/components/flag-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { CrossWeekStats } from "@/lib/training/cross-training"
import type { DisciplineAnalysis } from "@/lib/get-analysis"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 10

function formatMinutes(min: number): string {
  if (min <= 0) return "0m"
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono text-2xl tabular-nums">{value}</span>
      {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
    </div>
  )
}

function acwrLabel(acwr: number | null): string {
  if (acwr === null) return "Building baseline"
  if (acwr > 1.5) return "Spike zone"
  if (acwr < 0.8) return "Headroom"
  if (acwr <= 1.3) return "Sweet spot"
  return "Caution band"
}

function ThisWeeksCall({ label, week }: { label: string; week: CrossWeekStats }) {
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>{label} — this week&apos;s call</span>
          <span className="text-xs font-normal text-muted-foreground">Week of {week.weekStart}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Time" value={formatMinutes(week.minutes)} sub="this week" />
          <Metric
            label="Sessions"
            value={`${week.sessions}`}
            sub={week.avgSessionMin ? `${week.avgSessionMin}m avg` : "—"}
          />
          <Metric label="ACWR" value={week.acwr?.toFixed(2) ?? "—"} sub={acwrLabel(week.acwr)} />
          <Metric
            label="Change"
            value={week.wowChangePct !== null ? `${week.wowChangePct > 0 ? "+" : ""}${week.wowChangePct}%` : "—"}
            sub="vs last week"
          />
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-medium">
              <span className={cn("size-2 rounded-full", severityDot(week.flag.severity))} aria-hidden="true" />
              Load status
            </span>
            <FlagBadge direction={week.flag.direction} />
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{week.flag.reason}</p>
        </div>

        {/* The load engine's concrete, actionable recommendation. */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-primary">What to adjust</span>
          <p className="text-sm leading-relaxed text-foreground text-pretty">{week.flag.adjustment}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function WeeklyTimeline({ weeks }: { weeks: CrossWeekStats[] }) {
  const reversed = [...weeks].reverse()
  const pageCount = Math.max(1, Math.ceil(reversed.length / PAGE_SIZE))
  const [page, setPage] = useState(0)
  const clampedPage = Math.min(page, pageCount - 1)
  const paged = reversed.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Weekly log</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Week</th>
                <th className="pb-2 pr-4 font-medium tabular-nums">Time</th>
                <th className="pb-2 pr-4 font-medium tabular-nums">Sessions</th>
                <th className="pb-2 pr-4 font-medium tabular-nums">ACWR</th>
                <th className="pb-2 font-medium">Call</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((w) => (
                <tr key={w.weekStart} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 pr-4 whitespace-nowrap text-muted-foreground">{w.weekStart}</td>
                  <td className="py-2.5 pr-4 font-mono tabular-nums">{formatMinutes(w.minutes)}</td>
                  <td className="py-2.5 pr-4 font-mono tabular-nums">{w.sessions}</td>
                  <td className="py-2.5 pr-4 font-mono tabular-nums">{w.acwr?.toFixed(2) ?? "—"}</td>
                  <td className="py-2.5">
                    <FlagBadge direction={w.flag.direction} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageCount > 1 ? (
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Page {clampedPage + 1} of {pageCount}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={clampedPage === 0}
              >
                <ChevronLeft className="size-4" />
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={clampedPage === pageCount - 1}
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function DisciplineSummary({ analysis }: { analysis: DisciplineAnalysis }) {
  const { weeks, sessionCount, label } = analysis

  if (sessionCount === 0 || weeks.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-sm font-medium">No {label.toLowerCase()} logged yet</p>
          <p className="max-w-sm text-sm text-muted-foreground text-pretty">
            Connect Strava and sync, or import activities of this type. Once you have a few sessions, you&apos;ll get a
            weekly load read and a concrete recommendation for what to adjust.
          </p>
        </CardContent>
      </Card>
    )
  }

  const latest = weeks[weeks.length - 1]

  return (
    <div className="flex flex-col gap-6">
      <ThisWeeksCall label={label} week={latest} />
      <WeeklyTimeline weeks={weeks} />
    </div>
  )
}
