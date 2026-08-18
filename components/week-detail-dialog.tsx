"use client"

import { Clock, Route, HeartPulse, CalendarDays } from "lucide-react"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatPace } from "@/lib/format"
import { recommendWorkout, type WorkoutItem } from "@/lib/training/workout-insights"

function formatMinutes(min: number): string {
  if (min <= 0) return "0m"
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

function Stat({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="font-mono tabular-nums text-foreground">{children}</span>
    </span>
  )
}

function WorkoutRow({ workout, weekWorkouts }: { workout: WorkoutItem; weekWorkouts: WorkoutItem[] }) {
  const insight = recommendWorkout(workout, weekWorkouts)
  const showDistance = workout.distanceMiles > 0

  return (
    <li className="rounded-lg border border-border/60 bg-muted/20 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{workout.name || formatDay(workout.startDate)}</p>
          <span className="text-xs text-muted-foreground">{formatDay(workout.startDate)}</span>
        </div>
        <span className="shrink-0 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {insight.tag}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <Stat icon={Clock}>{formatMinutes(workout.durationMin)}</Stat>
        {showDistance ? <Stat icon={Route}>{workout.distanceMiles} mi</Stat> : null}
        {showDistance && workout.paceSecPerMile ? <Stat icon={Clock}>{formatPace(workout.paceSecPerMile)}</Stat> : null}
        {workout.avgHr ? <Stat icon={HeartPulse}>{workout.avgHr} bpm</Stat> : null}
      </div>

      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground text-pretty">{insight.recommendation}</p>
    </li>
  )
}

export function WeekDetailDialog({
  open,
  onOpenChange,
  label,
  weekStart,
  weekEnd,
  workouts,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  label: string
  weekStart: string
  weekEnd: string
  /** Only the workouts that fall within this week. */
  workouts: WorkoutItem[]
}) {
  const sorted = [...workouts].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {label} — week of {weekStart}
          </DialogTitle>
          <DialogDescription>
            {sorted.length > 0
              ? `${sorted.length} session${sorted.length === 1 ? "" : "s"} · ${weekStart} → ${weekEnd}`
              : `${weekStart} → ${weekEnd}`}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          {sorted.length > 0 ? (
            <ul className="flex flex-col gap-2.5">
              {sorted.map((w) => (
                <WorkoutRow key={w.id} workout={w} weekWorkouts={sorted} />
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-1.5 py-10 text-center">
              <CalendarDays className="size-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">No {label.toLowerCase()} sessions this week</p>
              <p className="max-w-xs text-pretty text-xs text-muted-foreground">
                This was a rest or gap week. Zero-volume weeks still count toward your rolling load average.
              </p>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
