"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Radio } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useNotifications, type AppNotification } from "@/lib/notification-context"
import { notificationMeta, relativeTime } from "@/lib/notification-display"
import { cn } from "@/lib/utils"

export function DashboardLiveFeed() {
  const router = useRouter()
  const { notifications, connected, markRead } = useNotifications()
  const recent = notifications.slice(0, 6)

  const handleOpen = (n: AppNotification) => {
    if (!n.read) markRead(n.id)
    if (n.link) router.push(n.link)
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          Live Activity
          <span className="flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
            <Radio className={cn("size-3", connected ? "text-success" : "text-muted-foreground")} />
            {connected ? "Live" : "Reconnecting…"}
          </span>
        </CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
            <Link href="/notifications">View All</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {recent.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">No activity yet — updates appear here in real time.</p>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((notif) => {
              const { icon: Icon, color } = notificationMeta(notif.type)
              return (
                <button
                  key={notif.id}
                  onClick={() => handleOpen(notif)}
                  className={cn(
                    "flex w-full items-start gap-3 px-6 py-3 text-left transition-colors hover:bg-muted/40",
                    !notif.read && "bg-primary/5",
                  )}
                >
                  <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/50", color)}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{notif.title}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(notif.createdAt)}</span>
                    </div>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{notif.message}</p>
                  </div>
                  {!notif.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-chart-1" />}
                </button>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
