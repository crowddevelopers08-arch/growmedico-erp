"use client"

import { BellRing, BellOff, BellPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useNotifications } from "@/lib/notification-context"
import { cn } from "@/lib/utils"

/**
 * Enable / disable OS-level browser push. Renders nothing when the browser
 * doesn't support push at all.
 *
 * variant="button"  → standalone button (e.g. notifications page header)
 * variant="banner"  → inline prompt row (e.g. inside the bell dropdown)
 */
export function PushToggle({ variant = "button" }: { variant?: "button" | "banner" }) {
  const { pushState, enablePush, disablePush } = useNotifications()

  if (pushState === "unsupported") return null

  if (variant === "banner") {
    if (pushState === "granted" || pushState === "denied") return null
    return (
      <button
        onClick={enablePush}
        className="flex w-full items-center gap-2 bg-primary/5 px-3 py-2 text-left text-xs text-primary transition-colors hover:bg-primary/10"
      >
        <BellPlus className="size-3.5 shrink-0" />
        <span>Turn on desktop notifications so alerts reach you even when this tab is closed.</span>
      </button>
    )
  }

  if (pushState === "denied") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <BellOff className="size-3.5" />
        Notifications blocked in browser settings
      </div>
    )
  }

  if (pushState === "granted") {
    return (
      <Button variant="outline" size="sm" onClick={disablePush} className="gap-1.5">
        <BellRing className={cn("size-4 text-success")} />
        Push on
      </Button>
    )
  }

  return (
    <Button variant="outline" size="sm" onClick={enablePush} className="gap-1.5">
      <BellPlus className="size-4" />
      Enable push
    </Button>
  )
}
