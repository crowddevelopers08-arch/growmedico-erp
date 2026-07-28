"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

function format(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

/**
 * Ticks once a second from `startedAt` (UNIX ms). Derives elapsed from the
 * timestamp rather than counting, so it stays accurate across tab throttling.
 */
export function CallTimer({ startedAt, className }: { startedAt: number | null; className?: string }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!startedAt) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [startedAt])

  if (!startedAt) return null
  return (
    <span className={cn("font-mono tabular-nums", className)}>{format((now - startedAt) / 1000)}</span>
  )
}
