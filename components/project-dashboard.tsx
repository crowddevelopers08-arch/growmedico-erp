"use client"

import { useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AlertTriangle, CheckCircle2, CircleDot, ListTodo, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { labelFor } from "@/lib/project-defaults"
import type { ClientProject, ProjectAttribute, Task } from "@/lib/types"

const PRIORITY_COLORS: Record<string, string> = {
  low: "#64748b",
  medium: "#3b82f6",
  high: "#f97316",
  urgent: "#ef4444",
}

/**
 * A status counts as "done" when the project marked it terminal in the wizard.
 * Falls back to the two names the app shipped with so projects created before
 * attributes existed still report progress correctly.
 */
function buildTerminalSet(attributes: ProjectAttribute[]) {
  const terminal = new Set(
    attributes.filter((a) => a.scope === "task" && a.kind === "status" && a.isTerminal).map((a) => a.name)
  )
  if (terminal.size === 0) {
    terminal.add("completed")
    terminal.add("cancelled")
  }
  return terminal
}

function isOverdue(task: Task, terminal: Set<string>) {
  if (!task.dueDate || terminal.has(task.status)) return false
  const due = new Date(task.dueDate)
  if (Number.isNaN(due.getTime())) return false
  // Compare on date only — a task due today is not overdue until tomorrow.
  const endOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59, 999)
  return endOfDue.getTime() < Date.now()
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string
  value: number
  icon: typeof ListTodo
  tone: string
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold tabular-nums">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function ProjectDashboard({
  project,
  tasks,
}: {
  project: ClientProject
  tasks: Task[]
}) {
  const attributes = project.attributes ?? []
  const terminal = useMemo(() => buildTerminalSet(attributes), [attributes])

  const stats = useMemo(() => {
    const completed = tasks.filter((task) => terminal.has(task.status)).length
    const inProgress = tasks.filter((task) => task.status === "in_progress").length
    const overdue = tasks.filter((task) => isOverdue(task, terminal)).length
    return {
      total: tasks.length,
      completed,
      inProgress,
      overdue,
      open: tasks.length - completed,
    }
  }, [tasks, terminal])

  const priorityData = useMemo(() => {
    const counts = new Map<string, number>()
    for (const task of tasks) counts.set(task.priority, (counts.get(task.priority) ?? 0) + 1)
    return ["low", "medium", "high", "urgent"]
      .filter((priority) => counts.has(priority))
      .map((priority) => ({
        name: priority.charAt(0).toUpperCase() + priority.slice(1),
        value: counts.get(priority) ?? 0,
        fill: PRIORITY_COLORS[priority] ?? "#64748b",
      }))
  }, [tasks])

  // Tasks completed per week over the last 8 weeks, keyed off updatedAt since
  // that is when a task last moved — there is no separate completedAt.
  const weeklyData = useMemo(() => {
    const weeks: Array<{ name: string; value: number }> = []
    const now = new Date()
    for (let offset = 7; offset >= 0; offset -= 1) {
      const end = new Date(now)
      end.setDate(now.getDate() - offset * 7)
      const start = new Date(end)
      start.setDate(end.getDate() - 6)

      const value = tasks.filter((task) => {
        if (!terminal.has(task.status)) return false
        const at = new Date(task.updatedAt)
        return at >= start && at <= end
      }).length

      weeks.push({ name: `${start.getDate()}/${start.getMonth() + 1}`, value })
    }
    return weeks
  }, [tasks, terminal])

  // Funnel: how many tasks sit in each stage, in pipeline order.
  const stageData = useMemo(() => {
    const stages = project.projectStages?.length
      ? [...project.projectStages].sort((a, b) => a.orderIndex - b.orderIndex)
      : (project.stages ?? []).map((name, index) => ({ id: name, name, color: "#64748b", orderIndex: index }))

    return stages.map((stage) => ({
      name: stage.name,
      value: tasks.filter((task) => (task.stage ?? "") === stage.name).length,
      fill: stage.color,
    }))
  }, [project.projectStages, project.stages, tasks])

  const progress = stats.total === 0 ? 0 : Math.round((stats.completed / stats.total) * 100)
  const maxStage = Math.max(1, ...stageData.map((item) => item.value))

  return (
    <div className="space-y-5">
      <div className="grid gap-3 @sm:grid-cols-2 @2xl:grid-cols-5">
        <StatCard label="Total tasks" value={stats.total} icon={ListTodo} tone="bg-primary/10 text-primary" />
        <StatCard label="Overdue" value={stats.overdue} icon={AlertTriangle} tone="bg-destructive/10 text-destructive" />
        <StatCard label="Open" value={stats.open} icon={CircleDot} tone="bg-muted text-muted-foreground" />
        <StatCard label="In progress" value={stats.inProgress} icon={Loader2} tone="bg-warning/10 text-warning" />
        <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} tone="bg-success/10 text-success" />
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Overall progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-3xl font-semibold tabular-nums">{progress}%</span>
            <span className="text-sm text-muted-foreground">
              {stats.completed} of {stats.total} done
            </span>
          </div>
          <Progress value={progress} />
        </CardContent>
      </Card>

      <div className="grid gap-4 @3xl:grid-cols-2">
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Tasks by priority</CardTitle>
          </CardHeader>
          <CardContent>
            {priorityData.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No tasks yet.</p>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={priorityData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-xs" />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" />
                    <Tooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.75rem",
                        fontSize: "0.8rem",
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {priorityData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Completed per week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-xs" />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "0.75rem",
                      fontSize: "0.8rem",
                    }}
                  />
                  <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stage funnel. Drawn as bars rather than a chart so long stage names
          stay readable and the whole thing reflows on narrow screens. */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Tasks by stage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stageData.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">This project has no stages.</p>
          ) : (
            stageData.map((stage) => (
              <div key={stage.name} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.fill }} />
                    <span className="min-w-0 wrap-break-word">{labelFor(stage.name)}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{stage.value}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{ width: `${(stage.value / maxStage) * 100}%`, backgroundColor: stage.fill }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
