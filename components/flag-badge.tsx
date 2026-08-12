import type { Flag, FlagDirection } from "@/lib/training/algorithm"
import { cn } from "@/lib/utils"
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"

const DIRECTION_META: Record<
  FlagDirection,
  { label: string; icon: typeof ArrowUpRight; className: string }
> = {
  rampup: {
    label: "Ramp up",
    icon: ArrowUpRight,
    className: "bg-success/15 text-success border-success/30",
  },
  cutback: {
    label: "Cut back",
    icon: ArrowDownRight,
    className: "bg-danger/15 text-danger border-danger/30",
  },
  hold: {
    label: "Hold",
    icon: Minus,
    className: "bg-muted text-muted-foreground border-border",
  },
}

export function FlagBadge({ direction, className }: { direction: FlagDirection; className?: string }) {
  const meta = DIRECTION_META[direction]
  const Icon = meta.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums",
        meta.className,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {meta.label}
    </span>
  )
}

export function severityDot(severity: Flag["severity"]): string {
  return severity === "high" ? "bg-danger" : severity === "moderate" ? "bg-warning" : "bg-muted-foreground"
}
