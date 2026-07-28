"use client"

import { X } from "lucide-react"
import { notificationMeta, relativeTime } from "@/lib/notification-display"
import type { AppNotification } from "@/lib/notification-context"
import { cn } from "@/lib/utils"

/**
 * One notification row — the single rendering used by the header dropdown, the
 * notification center, and any future surface. `variant` tweaks density;
 * `onDismiss` (when passed) reveals the delete affordance on hover.
 */
export function NotificationCard({
  notification,
  onOpen,
  onDismiss,
  variant = "full",
  className,
}: {
  notification: AppNotification
  onOpen?: (n: AppNotification) => void
  onDismiss?: (id: string) => void
  variant?: "full" | "compact"
  className?: string
}) {
  const { icon: Icon, color } = notificationMeta(notification.type)
  const compact = variant === "compact"

  return (
    <div
      className={cn(
        "group relative flex items-start gap-3 transition-colors hover:bg-muted/60",
        compact ? "px-3 py-2.5" : "px-4 py-3",
        !notification.read && "bg-primary/5",
        className,
      )}
    >
      <span className={cn("mt-0.5 shrink-0", color)}>
        <Icon className="size-4" />
      </span>

      <button
        type="button"
        onClick={() => onOpen?.(notification)}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <span className={cn("truncate font-medium", compact ? "text-sm" : "text-sm")}>
            {notification.title}
          </span>
          <span className="shrink-0 text-tiny text-muted-foreground">
            {relativeTime(notification.createdAt)}
          </span>
        </div>
        <p className={cn("text-muted-foreground", compact ? "line-clamp-2 text-xs" : "text-sm")}>
          {notification.message}
        </p>
      </button>

      {!notification.read && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-chart-1" aria-label="Unread" />
      )}

      {onDismiss && (
        <button
          type="button"
          onClick={() => onDismiss(notification.id)}
          className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}
