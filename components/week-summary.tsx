"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { FlagBadge, severityDot } from "@/components/flag-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { WeekStats } from "@/lib/training/algorithm"
import { formatPace } from "@/lib/format"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 10

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono text-2xl tabular-nums">{value}</span>
      {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
    </div>
  )
}

export function ThisWeeksCall({ week }: { week: WeekStats }) {
  const acwrLabel =
    week.acwr === null
      ? "Building baseline"
      : week.acwr > 1.5
        ? "Danger zone"
        : week.acwr < 0.8
          ? "Detraining / headroom"
          : week.acwr <= 1.3
            ? "Sweet spot"
            : "Caution band"

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>This week&apos;s call</span>
          <span className="text-xs font-normal text-muted-foreground">Week of {week.weekStart}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric label="Volume" value={`${week.distanceMiles}`} sub="miles this week" />
          <Metric label="Avg pace" value={formatPace(week.avgPaceSecPerMile)} sub={week.avgHr ? `${week.avgHr} bpm avg` : "no HR data"} />
          <Metric label="ACWR" value={week.acwr?.toFixed(2) ?? "—"} sub={acwrLabel} />
          <Metric
            label="Sessions"
            value={`${week.sessions}`}
            sub={week.wowChangePct !== null ? `${week.wowChangePct > 0 ? "+" : ""}${week.wowChangePct}% vs last wk` : "—"}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[week.mileageFlag, week.paceFlag].map((flag) => (
            <div key={flag.category} className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium capitalize">
                  <span className={cn("size-2 rounded-full", severityDot(flag.severity))} aria-hidden="true" />
                  {flag.category}
                </span>
                <FlagBadge direction={flag.direction} />
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{flag.reason}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function WeeklyTimeline({ weeks }: { weeks: WeekStats[] }) {
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
        {/* Mobile: stacked cards — a wide table doesn't fit a phone screen. */}
        <div className="flex flex-col gap-2 md:hidden">
          {paged.map((w) => (
            <div key={w.weekStart} className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{w.weekStart}</span>
                <span className="font-mono text-sm tabular-nums">{w.distanceMiles} mi</span>
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                  Pace <span className="ml-0.5 font-mono tabular-nums text-foreground">{formatPace(w.avgPaceSecPerMile)}</span>
                </span>
                <span>
                  ACWR <span className="ml-0.5 font-mono tabular-nums text-foreground">{w.acwr?.toFixed(2) ?? "—"}</span>
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <FlagBadge direction={w.mileageFlag.direction} />
                <FlagBadge direction={w.paceFlag.direction} />
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: full table. */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Week</th>
                <th className="pb-2 pr-4 font-medium tabular-nums">Miles</th>
                <th className="pb-2 pr-4 font-medium tabular-nums">Pace</th>
                <th className="pb-2 pr-4 font-medium tabular-nums">ACWR</th>
                <th className="pb-2 pr-4 font-medium">Mileage</th>
                <th className="pb-2 font-medium">Pace call</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((w) => (
                <tr key={w.weekStart} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5 pr-4 whitespace-nowrap text-muted-foreground">{w.weekStart}</td>
                  <td className="py-2.5 pr-4 font-mono tabular-nums">{w.distanceMiles}</td>
                  <td className="py-2.5 pr-4 font-mono tabular-nums">{formatPace(w.avgPaceSecPerMile)}</td>
                  <td className="py-2.5 pr-4 font-mono tabular-nums">{w.acwr?.toFixed(2) ?? "—"}</td>
                  <td className="py-2.5 pr-4">
                    <FlagBadge direction={w.mileageFlag.direction} />
                  </td>
                  <td className="py-2.5">
                    <FlagBadge direction={w.paceFlag.direction} />
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
