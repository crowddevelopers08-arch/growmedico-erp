"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Plus, Search, Trash2, CheckCircle2, Clock, AlertCircle,
  CircleDot, CalendarIcon, ChevronDown, ClipboardList, MessageSquare,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useHR } from "@/lib/hr-context"
import { TaskDetailSheet } from "@/components/task-detail-sheet"
import type { Task, TaskStatus, TaskPriority } from "@/lib/types"

const priorityConfig = {
  low:    { label: "Low",    class: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
  medium: { label: "Medium", class: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  high:   { label: "High",   class: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  urgent: { label: "Urgent", class: "bg-red-500/10 text-red-600 border-red-500/20" },
}

const statusConfig = {
  pending:     { label: "Pending",     icon: Clock,         class: "bg-warning/10 text-warning border-warning/20" },
  in_progress: { label: "In Progress", icon: CircleDot,     class: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  completed:   { label: "Completed",   icon: CheckCircle2,  class: "bg-success/10 text-success border-success/20" },
  cancelled:   { label: "Cancelled",   icon: AlertCircle,   class: "bg-muted text-muted-foreground border-border" },
}

const statuses: TaskStatus[] = ["pending", "in_progress", "completed", "cancelled"]
const priorities: TaskPriority[] = ["low", "medium", "high", "urgent"]

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const cfg = priorityConfig[priority]
  return <Badge variant="outline" className={`text-xs ${cfg.class}`}>{cfg.label}</Badge>
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const cfg = statusConfig[status]
  const Icon = cfg.icon
  return (
    <Badge variant="outline" className={`text-xs gap-1 ${cfg.class}`}>
      <Icon className="size-3" />{cfg.label}
    </Badge>
  )
}

function TasksPageContent() {
  const { data: session } = useSession()
  const { employees } = useHR()
  const isAdmin = session?.user?.role === "ADMIN"

  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<TaskStatus | "all">("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [deleteTask, setDeleteTask] = useState<Task | null>(null)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formTitle, setFormTitle] = useState("")
  const [formDesc, setFormDesc] = useState("")
  const [formAssignee, setFormAssignee] = useState("")
  const [formPriority, setFormPriority] = useState<TaskPriority>("medium")
  const [formDueDate, setFormDueDate] = useState("")

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks")
      if (res.ok) setTasks(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])

  const openAdd = () => {
    setEditTask(null)
    setFormTitle(""); setFormDesc(""); setFormAssignee("")
    setFormPriority("medium"); setFormDueDate("")
    setDialogOpen(true)
  }

  const openEdit = (task: Task) => {
    setEditTask(task)
    setFormTitle(task.title)
    setFormDesc(task.description ?? "")
    setFormAssignee(task.assignedToId)
    setFormPriority(task.priority)
    setFormDueDate(task.dueDate ?? "")
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formTitle.trim() || !formAssignee) return
    setSaving(true)
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDesc.trim() || null,
        assignedToId: formAssignee,
        priority: formPriority,
        dueDate: formDueDate || null,
      }
      if (editTask) {
        const res = await fetch(`/api/tasks/${editTask.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        if (!res.ok) throw new Error((await res.json()).error)
        toast.success("Task updated")
      } else {
        const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        if (!res.ok) throw new Error((await res.json()).error)
        toast.success("Task assigned")
      }
      setDialogOpen(false)
      await loadTasks()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (task: Task, status: TaskStatus) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
      if (!res.ok) throw new Error()
      await loadTasks()
      toast.success("Status updated")
    } catch {
      toast.error("Failed to update status")
    }
  }

  const handleDelete = async () => {
    if (!deleteTask) return
    try {
      await fetch(`/api/tasks/${deleteTask.id}`, { method: "DELETE" })
      toast.success("Task deleted")
      setDeleteTask(null)
      await loadTasks()
    } catch {
      toast.error("Failed to delete task")
    }
  }

  const filtered = tasks.filter((t) => {
    const matchesTab = activeTab === "all" || t.status === activeTab
    const employee = employees.find((e) => e.id === t.assignedToId)
    const matchesSearch = !searchQuery ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee?.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesTab && matchesSearch
  })

  const counts = {
    all: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    cancelled: tasks.filter((t) => t.status === "cancelled").length,
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const isOverdue = (task: Task) => task.dueDate && task.status !== "completed" && task.status !== "cancelled" && new Date(task.dueDate) < new Date()

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "Assign and track tasks across your team." : "View and update your assigned tasks."}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openAdd} className="sm:shrink-0">
            <Plus className="mr-2 size-4" />Assign Task
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {(["pending", "in_progress", "completed", "cancelled"] as TaskStatus[]).map((s) => {
          const cfg = statusConfig[s]
          const Icon = cfg.icon
          return (
            <Card key={s} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex size-9 items-center justify-center rounded-lg ${cfg.class.split(" ").map(c => c.startsWith("bg-") ? c : "").join(" ")}`}>
                    <Icon className={`size-4 ${cfg.class.split(" ").find(c => c.startsWith("text-"))}`} />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{counts[s]}</p>
                    <p className="text-xs text-muted-foreground">{cfg.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Task List */}
      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TaskStatus | "all")}>
              <TabsList>
                <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="in_progress">In Progress</TabsTrigger>
                <TabsTrigger value="completed">Done</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative flex-1 sm:flex-none sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 w-full" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Loading tasks...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
              <ClipboardList className="size-8 opacity-40" />
              <p className="text-sm">No tasks found</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map((task) => {
                const employee = employees.find((e) => e.id === task.assignedToId)
                const overdue = isOverdue(task)
                return (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => { setDetailTask(task); setDetailOpen(true) }}
                  >
                    {/* Left: priority indicator */}
                    <div className={`mt-1 size-2 rounded-full shrink-0 ${
                      task.priority === "urgent" ? "bg-red-500" :
                      task.priority === "high" ? "bg-orange-500" :
                      task.priority === "medium" ? "bg-blue-500" : "bg-slate-400"
                    }`} />

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                        <PriorityBadge priority={task.priority} />
                        <StatusBadge status={task.status} />
                        {overdue && (
                          <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/20">Overdue</Badge>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mb-1">{task.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {employee && (
                          <div className="flex items-center gap-1.5">
                            <Avatar className="size-4">
                              <AvatarImage src={employee.avatar} />
                              <AvatarFallback className="text-[8px]">{employee.initials}</AvatarFallback>
                            </Avatar>
                            <span>{employee.name}</span>
                          </div>
                        )}
                        {task.dueDate && (
                          <div className={`flex items-center gap-1 ${overdue ? "text-red-500" : ""}`}>
                            <CalendarIcon className="size-3" />
                            <span>Due {formatDate(task.dueDate)}</span>
                          </div>
                        )}
                        <span>Created {formatDate(task.createdAt)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-8 px-2 gap-1 text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); setDetailTask(task); setDetailOpen(true) }}>
                        <MessageSquare className="size-3.5" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 px-2 shrink-0">
                            <ChevronDown className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Update Status</div>
                        {statuses.map((s) => (
                          <DropdownMenuItem
                            key={s}
                            onClick={() => handleStatusChange(task, s)}
                            className={task.status === s ? "bg-muted" : ""}
                          >
                            {statusConfig[s].label}
                          </DropdownMenuItem>
                        ))}
                        {isAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openEdit(task)}>Edit Task</DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteTask(task)}
                            >
                              <Trash2 className="mr-2 size-4" />Delete
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Detail Sheet */}
      <TaskDetailSheet
        task={detailTask}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        employeeName={employees.find(e => e.id === detailTask?.assignedToId)?.name}
        employeeAvatar={employees.find(e => e.id === detailTask?.assignedToId)?.avatar ?? undefined}
        isAdmin={isAdmin}
        onStatusChange={handleStatusChange}
        onEditTask={(t) => { setDetailOpen(false); setEditTask(t); setDialogOpen(true) }}
      />

      {/* Assign/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTask ? "Edit Task" : "Assign Task"}</DialogTitle>
            <DialogDescription>{editTask ? "Update task details." : "Assign a new task to a team member."}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input placeholder="Task title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Optional description..." rows={3} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Assign To *</Label>
                <Select value={formAssignee} onValueChange={setFormAssignee}>
                  <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-5"><AvatarImage src={e.avatar} /><AvatarFallback className="text-[9px]">{e.initials}</AvatarFallback></Avatar>
                          {e.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={formPriority} onValueChange={(v) => setFormPriority(v as TaskPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {priorities.map((p) => <SelectItem key={p} value={p}>{priorityConfig[p].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formTitle.trim() || !formAssignee || saving}>
              {saving ? "Saving..." : editTask ? "Update Task" : "Assign Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTask} onOpenChange={(o) => !o && setDeleteTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete &quot;{deleteTask?.title}&quot;? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default function TasksPage() {
  return (
    <DashboardLayout>
      <TasksPageContent />
    </DashboardLayout>
  )
}
