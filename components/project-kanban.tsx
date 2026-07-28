"use client"

import { useMemo, useState } from "react"
import { CalendarDays, MessageSquare, Plus } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { labelFor } from "@/lib/project-defaults"
import { cn } from "@/lib/utils"
import type { ClientProject, Employee, Task } from "@/lib/types"

const priorityClasses: Record<string, string> = {
  low: "border-border bg-muted text-muted-foreground",
  medium: "border-primary/20 bg-primary/10 text-primary",
  high: "border-warning/20 bg-warning/10 text-warning",
  urgent: "border-destructive/20 bg-destructive/10 text-destructive",
}

function formatDue(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function TaskCard({
  task,
  employees,
  statusColor,
  onOpen,
  onDragStart,
  dragging,
}: {
  task: Task
  employees: Employee[]
  statusColor?: string
  onOpen: () => void
  onDragStart: () => void
  dragging: boolean
}) {
  const assignee = employees.find((employee) => employee.id === task.assignedToId)
  const due = formatDue(task.dueDate)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className={cn(
        "cursor-pointer space-y-2.5 rounded-xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
        dragging && "opacity-50"
      )}
    >
      <p className="text-sm font-medium wrap-break-word">{task.title}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        {statusColor && (
          <Badge
            variant="outline"
            className="rounded-full text-tiny"
            style={{ borderColor: `${statusColor}55`, backgroundColor: `${statusColor}1a`, color: statusColor }}
          >
            {labelFor(task.status)}
          </Badge>
        )}
        <Badge variant="outline" className={cn("rounded-full text-tiny capitalize", priorityClasses[task.priority])}>
          {task.priority}
        </Badge>
        {(task.tags ?? []).map((tag) => (
          <Badge key={tag} variant="outline" className="rounded-full text-tiny">
            {tag}
          </Badge>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          {due && (
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3.5 shrink-0" />
              {due}
            </span>
          )}
          {typeof task.commentCount === "number" && task.commentCount > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="size-3.5 shrink-0" />
              {task.commentCount}
            </span>
          )}
        </div>

        {assignee && (
          <Avatar className="size-6 shrink-0" title={assignee.name}>
            <AvatarImage src={assignee.avatar} />
            <AvatarFallback className="bg-primary/15 text-tiny text-primary">{assignee.initials}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  )
}

/**
 * Stage board. Columns are the project's ordered stages; dragging a card calls
 * onMoveTask with the destination stage name, which is what Task.stage stores.
 */
export function ProjectKanban({
  project,
  tasks,
  employees,
  onOpenTask,
  onMoveTask,
  onAddTask,
  canEdit,
}: {
  project: ClientProject
  tasks: Task[]
  employees: Employee[]
  onOpenTask: (task: Task) => void
  onMoveTask: (task: Task, stage: string) => void
  onAddTask?: (stage: string) => void
  canEdit: boolean
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overStage, setOverStage] = useState<string | null>(null)

  const stages = useMemo(() => {
    if (project.projectStages?.length) {
      return [...project.projectStages].sort((a, b) => a.orderIndex - b.orderIndex)
    }
    return (project.stages ?? []).map((name, index) => ({
      id: name,
      projectId: project.id,
      name,
      color: "#64748b",
      orderIndex: index,
    }))
  }, [project.projectStages, project.stages, project.id])

  const statusColors = useMemo(() => {
    const map = new Map<string, string>()
    for (const attribute of project.attributes ?? []) {
      if (attribute.scope === "task" && attribute.kind === "status") map.set(attribute.name, attribute.color)
    }
    return map
  }, [project.attributes])

  // Any task whose stage no longer exists is surfaced in the first column rather
  // than vanishing off the board.
  const byStage = useMemo(() => {
    const known = new Set(stages.map((stage) => stage.name))
    const map = new Map<string, Task[]>()
    for (const stage of stages) map.set(stage.name, [])

    for (const task of tasks) {
      const stage = task.stage && known.has(task.stage) ? task.stage : stages[0]?.name
      if (!stage) continue
      map.get(stage)?.push(task)
    }

    for (const list of map.values()) {
      list.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || a.createdAt.localeCompare(b.createdAt))
    }
    return map
  }, [stages, tasks])

  if (stages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        This project has no stages yet. Add some from Manage Stages.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto pb-3">
      <div className="flex min-w-max gap-3">
        {stages.map((stage) => {
          const stageTasks = byStage.get(stage.name) ?? []
          const done = stageTasks.filter((task) => task.status === "completed").length

          return (
            <div
              key={stage.id}
              onDragOver={(event) => {
                if (!canEdit) return
                event.preventDefault()
                setOverStage(stage.name)
              }}
              onDragLeave={() => setOverStage((current) => (current === stage.name ? null : current))}
              onDrop={(event) => {
                event.preventDefault()
                setOverStage(null)
                if (!canEdit || !draggingId) return
                const task = tasks.find((item) => item.id === draggingId)
                setDraggingId(null)
                if (!task || task.stage === stage.name) return
                onMoveTask(task, stage.name)
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-2xl border bg-muted/30 transition-colors",
                overStage === stage.name && "border-primary bg-primary/5"
              )}
            >
              <div className="flex items-center gap-2 border-b px-3 py-2.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium" title={stage.name}>
                  {stage.name}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {done}/{stageTasks.length}
                </span>
              </div>

              <div className="flex-1 space-y-2 p-2">
                {stageTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    employees={employees}
                    statusColor={statusColors.get(task.status)}
                    dragging={draggingId === task.id}
                    onDragStart={() => setDraggingId(task.id)}
                    onOpen={() => onOpenTask(task)}
                  />
                ))}

                {stageTasks.length === 0 && (
                  <p className="rounded-xl border border-dashed py-6 text-center text-xs text-muted-foreground">
                    Drop tasks here
                  </p>
                )}
              </div>

              {canEdit && onAddTask && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="m-2 mt-0 justify-start text-muted-foreground"
                  onClick={() => onAddTask(stage.name)}
                >
                  <Plus className="size-4" /> Add task
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
