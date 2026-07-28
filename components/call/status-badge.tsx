"use client"

import { Signal, SignalHigh, SignalLow, SignalMedium, SignalZero, WifiOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ConnectionQuality } from "@/lib/call/store"

// ── Presence badge ────────────────────────────────────────────────────────
export function PresenceBadge({ online }: { online: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full",
        online
          ? "border-success/30 bg-success/10 text-success"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      <span className={cn("size-1.5 rounded-full", online ? "bg-success" : "bg-muted-foreground")} />
      {online ? "Online" : "Offline"}
    </Badge>
  )
}

// ── Network-quality indicator ─────────────────────────────────────────────
const QUALITY = {
  excellent: { icon: SignalHigh, label: "Excellent", cls: "text-success" },
  good: { icon: SignalMedium, label: "Good", cls: "text-success" },
  poor: { icon: SignalLow, label: "Poor", cls: "text-warning" },
  lost: { icon: WifiOff, label: "Connection lost", cls: "text-destructive" },
  unknown: { icon: SignalZero, label: "Connecting", cls: "text-muted-foreground" },
} as const

export function NetworkQuality({
  quality,
  reconnecting,
  showLabel = false,
  className,
}: {
  quality: ConnectionQuality
  reconnecting?: boolean
  showLabel?: boolean
  className?: string
}) {
  if (reconnecting) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs text-warning", className)}>
        <Signal className="size-4 animate-pulse" />
        Reconnecting…
      </span>
    )
  }
  const q = QUALITY[quality]
  const Icon = q.icon
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", q.cls, className)} title={q.label}>
      <Icon className="size-4" />
      {showLabel && q.label}
    </span>
  )
}
