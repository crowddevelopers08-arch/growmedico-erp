"use client"

import { useEffect, useState } from "react"
import { Clock, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Task, TaskStatus } from "@/lib/types"
import { formatWorkingDuration, workingMsBetween, workingTimeStatus, type UrgencyLevel } from "@/lib/working-time"

/** Current time that re-renders every `intervalMs`. Shared across badges cheaply. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

const levelStyles: Record<UrgencyLevel, string> = {
  green: "border-success/30 bg-success/10 text-success",
  orange: "border-warning/30 bg-warning/10 text-warning",
  red: "border-destructive/30 bg-destructive/10 text-destructive",
  overdue: "border-destructive bg-destructive/15 text-destructive",
}

interface WorkingTimeBadgeProps {
  task: Pick<Task, "estimatedHours" | "createdAt" | "status">
  /** Update cadence. 1s by default so the seconds in the label actually tick. */
  intervalMs?: number
  className?: string
}

/**
 * Live, color-coded remaining-working-time chip. Counts only office hours
 * (10:00–19:00 IST, Sundays excluded), so it naturally freezes overnight and on
 * Sundays. Renders nothing when the task has no allocation, or is done/cancelled.
 */
export function WorkingTimeBadge({ task, intervalMs = 1000, className }: WorkingTimeBadgeProps) {
  const now = useNow(intervalMs)

  const finished: TaskStatus[] = ["completed", "cancelled"]
  if (!task.estimatedHours || finished.includes(task.status)) return null

  const assignedEpoch = new Date(task.createdAt).getTime()
  if (Number.isNaN(assignedEpoch)) return null

  const status = workingTimeStatus(assignedEpoch, task.estimatedHours, now)
  const Icon = status.overdue ? AlertTriangle : Clock
  // Overdue: show working time elapsed past the deadline.
  const overrun = status.overdue ? workingMsBetween(status.deadlineEpoch, now) : 0
  const label = status.overdue
    ? `Overdue by ${formatWorkingDuration(overrun)}`
    : `${formatWorkingDuration(status.remainingMs)} left`

  return (
    <span
      className={cn(
        // tabular-nums keeps the chip from twitching as the digits change.
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-tiny font-semibold tabular-nums",
        levelStyles[status.level],
        className,
      )}
      title={`Deadline: ${new Date(status.deadlineEpoch).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} (working hours, Sundays excluded)`}
    >
      <Icon className="size-3 shrink-0" />
      {label}
    </span>
  )
}
