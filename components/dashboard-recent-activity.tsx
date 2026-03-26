"use client"

import { CalendarDays, Clock, DollarSign, Users, Settings } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useHR } from "@/lib/hr-context"

const getActivityIcon = (type: string) => {
  switch (type) {
    case "leave":
      return CalendarDays
    case "attendance":
      return Clock
    case "salary":
      return DollarSign
    case "employee":
      return Users
    default:
      return Settings
  }
}

const getActivityBadge = (type: string) => {
  switch (type) {
    case "leave":
      return <Badge variant="secondary" className="bg-chart-1/10 text-chart-1 border-0">Leave</Badge>
    case "attendance":
      return <Badge variant="secondary" className="bg-success/10 text-success border-0">Attendance</Badge>
    case "salary":
      return <Badge variant="secondary" className="bg-chart-3/10 text-chart-3 border-0">Salary</Badge>
    case "employee":
      return <Badge variant="secondary" className="bg-chart-5/10 text-chart-5 border-0">Employee</Badge>
    default:
      return <Badge variant="secondary">System</Badge>
  }
}

const formatTimeAgo = (timestamp: string) => {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  
  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function DashboardRecentActivity() {
  const { activities } = useHR()
  const recentActivities = activities.slice(0, 6)

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
        <CardAction>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
            <Link href="/settings">View All</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {recentActivities.map((activity) => {
            const Icon = getActivityIcon(activity.type)
            return (
              <div
                key={activity.id}
                className="flex items-start gap-4 px-6 py-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex size-9 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
                  <Icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{activity.action}</p>
                    {getActivityBadge(activity.type)}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{activity.description}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatTimeAgo(activity.createdAt)}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
