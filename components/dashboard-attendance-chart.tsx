"use client"

import { useMemo } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardAction, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { useHR } from "@/lib/hr-context"

const chartConfig = {
  present: {
    label: "Present",
    color: "var(--color-success)",
  },
  remote: {
    label: "Remote",
    color: "var(--color-chart-1)",
  },
  absent: {
    label: "Absent",
    color: "var(--color-destructive)",
  },
}

export function DashboardAttendanceChart() {
  const { attendance, employees } = useHR()

  const chartData = useMemo(() => {
    const last7Days = []
    const today = new Date()
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split("T")[0]
      const dayName = date.toLocaleDateString("en-US", { weekday: "short" })
      
      const dayAttendance = attendance.filter((a) => a.date === dateStr)
      const present = dayAttendance.filter((a) => a.status === "present").length
      const remote = dayAttendance.filter((a) => a.status === "remote").length
      const absent = employees.length - present - remote
      
      last7Days.push({
        day: dayName,
        present,
        remote,
        absent: Math.max(0, absent),
      })
    }
    
    return last7Days
  }, [attendance, employees])

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <div>
          <CardTitle className="text-base font-semibold">Attendance Overview</CardTitle>
          <CardDescription>Daily attendance for the past 7 days</CardDescription>
        </div>
        <CardAction>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            This Week
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="pb-4">
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillPresent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillRemote" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs fill-muted-foreground"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-xs fill-muted-foreground"
              />
              <ChartTooltip
                cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }}
                content={<ChartTooltipContent indicator="line" />}
              />
              <Area
                dataKey="present"
                type="monotone"
                fill="url(#fillPresent)"
                stroke="var(--color-success)"
                strokeWidth={2}
                stackId="a"
              />
              <Area
                dataKey="remote"
                type="monotone"
                fill="url(#fillRemote)"
                stroke="var(--color-chart-1)"
                strokeWidth={2}
                stackId="a"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
        <div className="mt-4 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="size-3 rounded-full bg-success" />
            <span className="text-xs text-muted-foreground">Present</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-3 rounded-full bg-chart-1" />
            <span className="text-xs text-muted-foreground">Remote</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
