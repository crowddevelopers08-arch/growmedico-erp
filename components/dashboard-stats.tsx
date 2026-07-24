"use client"

import { Users, Clock, CalendarX, FileText, TrendingUp, TrendingDown, ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { useHR } from "@/lib/hr-context"

export function DashboardStats() {
  const { getStats } = useHR()
  const stats = getStats()

  const attendanceRate = stats.totalEmployees > 0
    ? Math.round((stats.presentToday / stats.totalEmployees) * 100)
    : 0

  const statsData = [
    {
      title: "Total Employees",
      value: stats.totalEmployees.toString(),
      change: "+12%",
      changeType: "positive" as const,
      icon: Users,
      description: "vs last month",
      href: "/employees",
    },
    {
      title: "Present Today",
      value: stats.presentToday.toString(),
      change: `${attendanceRate}%`,
      changeType: "positive" as const,
      icon: Clock,
      // Spell out the rest of the headcount — present + on leave rarely adds up
      // to the total, and the gap (absent) had nowhere to show.
      description: `attendance rate · ${stats.absentToday} absent`,
      href: "/attendance",
    },
    {
      title: "On Leave",
      value: stats.onLeave.toString(),
      change: stats.onLeave > 0 ? `${stats.onLeave}` : "0",
      changeType: "neutral" as const,
      icon: CalendarX,
      description: "employees away",
      href: "/leaves",
    },
    {
      title: "Pending Requests",
      value: stats.pendingRequests.toString(),
      change: stats.pendingRequests > 0 ? `+${stats.pendingRequests}` : "0",
      changeType: stats.pendingRequests > 0 ? "negative" as const : "neutral" as const,
      icon: FileText,
      description: "require action",
      href: "/leaves",
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statsData.map((stat) => (
        <Link key={stat.title} href={stat.href} className="group focus-visible:outline-none">
          <Card className="relative overflow-hidden border-border/50 transition-all group-hover:border-border group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring cursor-pointer">
            <CardContent className="p-6">
              <ArrowUpRight className="absolute right-4 top-4 size-4 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-2sm font-medium text-muted-foreground">{stat.title}</p>
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
        </Link>
      ))}
    </div>
  )
}
