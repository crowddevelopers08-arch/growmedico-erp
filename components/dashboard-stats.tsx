"use client"

import { Users, Clock, CalendarX, FileText, TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useHR } from "@/lib/hr-context"

export function DashboardStats() {
  const { getStats } = useHR()
  const stats = getStats()

  const statsData = [
    {
      title: "Total Employees",
      value: stats.totalEmployees.toString(),
      change: "+12%",
      changeType: "positive" as const,
      icon: Users,
      description: "vs last month",
    },
    {
      title: "Present Today",
      value: stats.presentToday.toString(),
      change: `${Math.round((stats.presentToday / stats.totalEmployees) * 100)}%`,
      changeType: "positive" as const,
      icon: Clock,
      description: "attendance rate",
    },
    {
      title: "On Leave",
      value: stats.onLeave.toString(),
      change: stats.onLeave > 0 ? `${stats.onLeave}` : "0",
      changeType: "neutral" as const,
      icon: CalendarX,
      description: "employees away",
    },
    {
      title: "Pending Requests",
      value: stats.pendingRequests.toString(),
      change: stats.pendingRequests > 0 ? `+${stats.pendingRequests}` : "0",
      changeType: stats.pendingRequests > 0 ? "negative" as const : "neutral" as const,
      icon: FileText,
      description: "require action",
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statsData.map((stat) => (
        <Card key={stat.title} className="group relative overflow-hidden border-border/50 transition-all hover:border-border hover:shadow-md">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-semibold tracking-tight text-foreground">{stat.value}</p>
                  <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                    stat.changeType === "positive" 
                      ? "text-success" 
                      : stat.changeType === "negative" 
                        ? "text-destructive" 
                        : "text-muted-foreground"
                  }`}>
                    {stat.changeType === "positive" && <TrendingUp className="size-3" />}
                    {stat.changeType === "negative" && <TrendingDown className="size-3" />}
                    {stat.change}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{stat.description}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                <stat.icon className="size-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
