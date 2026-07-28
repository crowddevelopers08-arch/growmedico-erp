"use client"

import { useEffect, useState } from "react"
import { Pause, Play, Timer } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Task } from "@/lib/types"

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  return [hours, minutes, rest].map((part) => String(part).padStart(2, "0")).join(":")
}

/**
 * Start/stop stopwatch for a task.
 *
 * The elapsed total is derived from the banked `trackedSeconds` plus the time
 * since `timerStartedAt`, so a running timer keeps counting correctly across a
 * reload or a different device — the browser never owns the clock.
 */
export function TaskTimeTracker({
  task,
  canTrack,
  onUpdated,
}: {
  task: Task
  canTrack: boolean
  onUpdated?: (task: Task) => void
}) {
  const [banked, setBanked] = useState(task.trackedSeconds ?? 0)
  const [startedAt, setStartedAt] = useState<string | null>(task.timerStartedAt ?? null)
  const [now, setNow] = useState(() => Date.now())
  const [saving, setSaving] = useState(false)

  // Re-sync when the sheet is pointed at a different task.
  useEffect(() => {
    setBanked(task.trackedSeconds ?? 0)
    setStartedAt(task.timerStartedAt ?? null)
  }, [task.id, task.trackedSeconds, task.timerStartedAt])

  const running = Boolean(startedAt)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [running])

  const liveSeconds = running && startedAt ? Math.max(0, (now - new Date(startedAt).getTime()) / 1000) : 0
  const elapsed = banked + liveSeconds

  const save = async (payload: { trackedSeconds: number; timerStartedAt: string | null }) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? "Could not update the timer")
      onUpdated?.(data)
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the timer")
      return false
    } finally {
      setSaving(false)
    }
  }

  const start = async () => {
    const startedIso = new Date().toISOString()
    setStartedAt(startedIso)
    setNow(Date.now())
    const ok = await save({ trackedSeconds: banked, timerStartedAt: startedIso })
    if (!ok) setStartedAt(null)
  }

  const stop = async () => {
    if (!startedAt) return
    const total = Math.round(banked + (Date.now() - new Date(startedAt).getTime()) / 1000)
    setBanked(total)
    setStartedAt(null)
    const ok = await save({ trackedSeconds: total, timerStartedAt: null })
    if (!ok) {
      setBanked(banked)
      setStartedAt(startedAt)
    }
  }

  const estimateSeconds = (task.estimatedHours ?? 0) * 3600
  const overEstimate = estimateSeconds > 0 && elapsed > estimateSeconds

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2">
      <Timer className={cn("size-4 shrink-0", running ? "text-primary" : "text-muted-foreground")} />

      <span className={cn("font-mono text-sm tabular-nums", overEstimate && "text-destructive")}>
        {formatDuration(elapsed)}
      </span>

      {task.estimatedHours ? (
        <span className="text-xs text-muted-foreground">of {task.estimatedHours}h estimated</span>
      ) : null}

      {canTrack && (
        <Button
          size="sm"
          variant={running ? "destructive" : "outline"}
          className="ml-auto h-7 shrink-0 gap-1.5 text-xs"
          onClick={() => (running ? stop() : start())}
          disabled={saving}
        >
          {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {running ? "Stop" : "Start"}
        </Button>
      )}
    </div>
  )
}
