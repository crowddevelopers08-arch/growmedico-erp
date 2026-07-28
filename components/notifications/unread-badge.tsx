"use client"

import { cn } from "@/lib/utils"

/**
 * Small count pill (caps at "9+"). Reused by the header bell and anywhere else
 * an unread count needs surfacing. Renders nothing at zero.
 */
export function UnreadBadge({
  count,
  className,
  max = 9,
}: {
  count: number
  className?: string
  max?: number
}) {
  if (count <= 0) return null
  return (
    <span
      className={cn(
        "flex h-4 min-w-4 items-center justify-center rounded-full bg-chart-1 px-1 text-tiny font-semibold text-white",
        className,
      )}
    >
      {count > max ? `${max}+` : count}
    </span>
  )
}
