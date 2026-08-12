"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { formatPace, type WeekStats } from "@/lib/training/algorithm"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

function shortWeek(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00Z")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
}

function barColor(direction: string): string {
  if (direction === "cutback") return "var(--color-danger)"
  if (direction === "rampup") return "var(--color-success)"
  return "var(--color-chart-2)"
}

export function LoadCharts({ weeks }: { weeks: WeekStats[] }) {
  const data = weeks.map((w) => ({
    week: shortWeek(w.weekStart),
    miles: w.distanceMiles,
    acwr: w.acwr,
    pace: w.avgPaceSecPerMile,
    mileageDir: w.mileageFlag.direction,
    paceDir: w.paceFlag.direction,
  }))

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly mileage & training load</CardTitle>
          <CardDescription>
            Bars are weekly miles (colored by recommendation). The line is your acute:chronic workload ratio (ACWR) —
            the shaded band (0.8–1.3) is the safe zone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            className="h-[260px] w-full"
            config={{
              miles: { label: "Miles", color: "var(--chart-2)" },
              acwr: { label: "ACWR", color: "var(--chart-1)" },
            }}
          >
            <ComposedChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
              <YAxis
                yAxisId="left"
                tickLine={false}
                axisLine={false}
                width={30}
                fontSize={11}
                label={{ value: "mi", position: "insideTopLeft", fontSize: 10, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 2]}
                tickLine={false}
                axisLine={false}
                width={30}
                fontSize={11}
              />
              <ReferenceArea
                yAxisId="right"
                y1={0.8}
                y2={1.3}
                fill="var(--success)"
                fillOpacity={0.1}
                ifOverflow="extendDomain"
              />
              <ReferenceLine
                yAxisId="right"
                y={1.5}
                stroke="var(--danger)"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload as (typeof data)[number]
                  return (
                    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                      <div className="mb-1 font-medium">Week of {p.week}</div>
                      <div className="tabular-nums text-muted-foreground">{p.miles} mi</div>
                      <div className="tabular-nums text-muted-foreground">
                        ACWR {p.acwr ?? "—"} · {formatPace(p.pace)}
                      </div>
                    </div>
                  )
                }}
              />
              <Bar yAxisId="left" dataKey="miles" radius={[3, 3, 0, 0]} maxBarSize={26}>
                {data.map((d, i) => (
                  <Cell key={i} fill={barColor(d.mileageDir)} />
                ))}
              </Bar>
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="acwr"
                stroke="var(--color-acwr)"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pace trend</CardTitle>
          <CardDescription>Average pace per mile each week. Lower is faster — a downward line means improving fitness.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            className="h-[260px] w-full"
            config={{ pace: { label: "Pace", color: "var(--chart-1)" } }}
          >
            <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} fontSize={11} />
              <YAxis
                reversed
                domain={["dataMin - 20", "dataMax + 20"]}
                tickFormatter={(v) => formatPace(v as number)}
                tickLine={false}
                axisLine={false}
                width={52}
                fontSize={11}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0].payload as (typeof data)[number]
                  return (
                    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                      <div className="mb-1 font-medium">Week of {p.week}</div>
                      <div className="tabular-nums text-muted-foreground">{formatPace(p.pace)}</div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="pace" radius={[3, 3, 0, 0]} maxBarSize={26}>
                {data.map((d, i) => (
                  <Cell key={i} fill={barColor(d.paceDir)} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}
