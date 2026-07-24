"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { CheckCheck, Trash2, X, BellOff } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useNotifications, type AppNotification } from "@/lib/notification-context"
import { notificationMeta, relativeTime } from "@/lib/notification-display"
import { PushToggle } from "@/components/push-toggle"
import { cn } from "@/lib/utils"

function startOfDay(iso: string) {
  const d = new Date(iso)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function groupLabel(iso: string) {
  const today = startOfDay(new Date().toISOString())
  const day = startOfDay(iso)
  const diffDays = Math.round((today - day) / 86_400_000)
  if (diffDays <= 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return "Earlier this week"
  return "Older"
}

export default function NotificationsPage() {
  const router = useRouter()
  const { notifications, unreadCount, markAllRead, markRead, dismiss, clearAll } = useNotifications()

  const groups = useMemo(() => {
    const order = ["Today", "Yesterday", "Earlier this week", "Older"]
    const map = new Map<string, AppNotification[]>()
    for (const n of notifications) {
      const label = groupLabel(n.createdAt)
      if (!map.has(label)) map.set(label, [])
      map.get(label)!.push(n)
    }
    return order.filter((label) => map.has(label)).map((label) => ({ label, items: map.get(label)! }))
  }, [notifications])

  const handleOpen = (n: AppNotification) => {
    if (!n.read) markRead(n.id)
    if (n.link) router.push(n.link)
  }

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PushToggle />
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={unreadCount === 0} className="gap-1.5">
            <CheckCheck className="size-4" />
            Mark all read
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
            disabled={notifications.length === 0}
            className="gap-1.5 text-muted-foreground"
          >
            <Trash2 className="size-4" />
            Clear all
          </Button>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-20 text-center">
          <BellOff className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label} className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </h2>
                <Badge variant="secondary" className="">
                  {group.items.length}
                </Badge>
              </div>
              <div className="overflow-hidden rounded-xl border border-border">
                {group.items.map((notif, idx) => {
                  const { icon: Icon, color } = notificationMeta(notif.type)
                  return (
                    <div
                      key={notif.id}
                      className={cn(
                        "group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
                        idx !== 0 && "border-t border-border",
                        !notif.read && "bg-primary/5",
                      )}
                    >
                      <span className={cn("mt-0.5 shrink-0", color)}>
                        <Icon className="size-4" />
                      </span>
                      <button onClick={() => handleOpen(notif)} className="min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{notif.title}</span>
                          {!notif.read && <span className="size-1.5 shrink-0 rounded-full bg-chart-1" />}
                        </div>
                        <p className="text-sm text-muted-foreground">{notif.message}</p>
                        <span className="mt-0.5 block text-tiny text-muted-foreground">
                          {relativeTime(notif.createdAt)}
                        </span>
                      </button>
                      <button
                        onClick={() => dismiss(notif.id)}
                        className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                        aria-label="Dismiss"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  )
}
