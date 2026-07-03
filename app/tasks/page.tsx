
"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Plus, Search, Trash2, CheckCircle2, Clock, AlertCircle,
  CircleDot, CalendarIcon, ChevronDown, ClipboardList, MessageSquare, BriefcaseBusiness,
  UserCircle, Handshake, ListChecks, User,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem,
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
import { taskCreateSchema, firstIssueMessage } from "@/lib/validations"
import type { Task, TaskStatus, TaskPriority, ClientProject, Employee } from "@/lib/types"

const priorityConfig = {
  low: { label: "Low", class: "bg-muted text-muted-foreground border-border" },
  medium: { label: "Medium", class: "bg-info/10 text-info border-info/20" },
  high: { label: "High", class: "bg-warning/10 text-warning border-warning/20" },
  urgent: { label: "Urgent", class: "bg-destructive/10 text-destructive border-destructive/20" },
}

const statusConfig = {
  pending: { label: "Pending", icon: Clock, class: "bg-warning/10 text-warning border-warning/20" },
  in_progress: { label: "In Progress", icon: CircleDot, class: "bg-info/10 text-info border-info/20" },
  completed: { label: "Completed", icon: CheckCircle2, class: "bg-success/10 text-success border-success/20" },
  cancelled: { label: "Cancelled", icon: AlertCircle, class: "bg-muted text-muted-foreground border-border" },
}

const statuses: TaskStatus[] = ["pending", "in_progress", "completed", "cancelled"]
const priorities: TaskPriority[] = ["low", "medium", "high", "urgent"]

type ListView = "all" | "assigned" | "collaborator" | "self"

const listViews: { id: ListView; label: string; icon: typeof ListChecks }[] = [
  { id: "all", label: "All Tasks", icon: ListChecks },
  { id: "assigned", label: "Assigned to me", icon: UserCircle },
  { id: "collaborator", label: "Collaborator Tasks", icon: Handshake },
  { id: "self", label: "Self Task", icon: User },
]

function projectLabel(task: Task) {
  if (task.clientName && task.projectName) return `${task.clientName} - ${task.projectName}`
  if (task.projectName) return task.projectName
  return ""
}

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
  const router = useRouter()
  const searchParams = useSearchParams()
  const listParam = searchParams.get("list")
  const activeList: ListView =
    listParam === "assigned" || listParam === "collaborator" || listParam === "self" ? listParam : "all"
  const isAdmin = session?.user?.role === "ADMIN"
  const canManageTasks = isAdmin || session?.user?.role === "MANAGER"

  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<ClientProject[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<TaskStatus | "all">("all")
  const [selectedProjectId, setSelectedProjectId] = useState("all")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [deleteTask, setDeleteTask] = useState<Task | null>(null)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [formTitle, setFormTitle] = useState("")
  const [formDesc, setFormDesc] = useState("")
  const [formProjectId, setFormProjectId] = useState("")
  const [formAssignees, setFormAssignees] = useState<string[]>([])
  const [formCollaboratorIds, setFormCollaboratorIds] = useState<string[]>([])
  const [formPriority, setFormPriority] = useState<TaskPriority>("medium")
  const [formDueDate, setFormDueDate] = useState("")

  const selectedFormProject = useMemo(
    () => projects.find((project) => project.id === formProjectId) ?? null,
    [formProjectId, projects]
  )

  const assignableProjectMembers = useMemo(() => {
    if (!selectedFormProject?.members?.length) return []

    return selectedFormProject.members
      .map((member) => employees.find((employee) => employee.id === member.employeeId) ?? member.employee)
      .filter((employee): employee is Employee => Boolean(employee))
  }, [employees, selectedFormProject])

  const loadTasks = useCallback(async () => {
    const res = await fetch("/api/tasks")
    if (res.ok) setTasks(await res.json())
  }, [])

  const loadProjects = useCallback(async () => {
    const res = await fetch("/api/projects")
    if (res.ok) setProjects(await res.json())
  }, [])

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      try {
        await Promise.all([loadTasks(), loadProjects()])
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [loadProjects, loadTasks])

  const openAdd = () => {
    setEditTask(null)
    setFormTitle("")
    setFormDesc("")
    setFormProjectId("")
    setFormAssignees(activeList === "self" && session?.user?.employeeId ? [session.user.employeeId] : [])
    setFormCollaboratorIds([])
    setFormPriority("medium")
    setFormDueDate("")
    setDialogOpen(true)
  }

  const openEdit = (task: Task) => {
    setEditTask(task)
    setFormTitle(task.title)
    setFormDesc(task.description ?? "")
    setFormProjectId(task.projectId ?? "")
    setFormAssignees([task.assignedToId])
    setFormCollaboratorIds(task.collaborators ?? [])
    setFormPriority(task.priority)
    setFormDueDate(task.dueDate ?? "")
    setDialogOpen(true)
  }

  const toggleFormCollaborator = (employeeId: string, checked: boolean) => {
    setFormCollaboratorIds((prev) =>
      checked ? (prev.includes(employeeId) ? prev : [...prev, employeeId]) : prev.filter((id) => id !== employeeId)
    )
  }

  useEffect(() => {
    if (!dialogOpen) return

    const validAssignees = formAssignees.filter((employeeId) =>
      assignableProjectMembers.some((employee) => employee.id === employeeId)
    )

    if (validAssignees.length !== formAssignees.length) {
      setFormAssignees(validAssignees)
    }
  }, [assignableProjectMembers, dialogOpen, formAssignees])

  useEffect(() => {
    if (!dialogOpen) return

    const validCollaborators = formCollaboratorIds.filter((employeeId) =>
      assignableProjectMembers.some((employee) => employee.id === employeeId)
    )

    if (validCollaborators.length !== formCollaboratorIds.length) {
      setFormCollaboratorIds(validCollaborators)
    }
  }, [assignableProjectMembers, dialogOpen, formCollaboratorIds])

  useEffect(() => {
    if (!dialogOpen || editTask || activeList !== "self") return
    const selfId = session?.user?.employeeId
    const isValidMember = selfId && assignableProjectMembers.some((employee) => employee.id === selfId)
    setFormAssignees(isValidMember ? [selfId] : [])
  }, [dialogOpen, editTask, activeList, assignableProjectMembers, session?.user?.employeeId])

  const handleSave = async () => {
    if (formAssignees.length === 0) {
      toast.error("Select who this task is assigned to")
      return
    }

    const parsed = taskCreateSchema.safeParse({
      title: formTitle.trim(),
      description: formDesc.trim() || null,
      projectId: formProjectId,
      assignedToId: formAssignees[0],
      collaborators: formCollaboratorIds,
      priority: formPriority,
      dueDate: formDueDate || null,
    })
    if (!parsed.success) {
      toast.error(firstIssueMessage(parsed.error))
      return
    }

    setSaving(true)

    try {
      if (editTask) {
        const payload = {
          title: formTitle.trim(),
          description: formDesc.trim() || null,
          projectId: formProjectId,
          assignedToId: formAssignees[0],
          collaborators: formCollaboratorIds,
          priority: formPriority,
          dueDate: formDueDate || null,
        }
        const res = await fetch(`/api/tasks/${editTask.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        toast.success("Task updated")
      } else {
        for (const assignedToId of formAssignees) {
          const payload = {
            title: formTitle.trim(),
            description: formDesc.trim() || null,
            projectId: formProjectId,
            assignedToId,
            collaborators: formCollaboratorIds,
            priority: formPriority,
            dueDate: formDueDate || null,
          }
          const res = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
          if (!res.ok) throw new Error((await res.json()).error)
        }
        toast.success(`${formAssignees.length} task${formAssignees.length === 1 ? "" : "s"} assigned`)
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
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
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

  const employeeId = session?.user?.employeeId
  const userId = session?.user?.id
  const isSelfTask = (task: Task) => Boolean(employeeId) && task.assignedToId === employeeId && task.assignedById === userId

  const listCounts = useMemo(() => ({
    all: tasks.length,
    assigned: employeeId ? tasks.filter((task) => task.assignedToId === employeeId && !isSelfTask(task)).length : 0,
    collaborator: employeeId ? tasks.filter((task) => task.collaborators?.includes(employeeId)).length : 0,
    self: employeeId ? tasks.filter(isSelfTask).length : 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [employeeId, userId, tasks])

  const listScopedTasks = useMemo(() => {
    if (activeList === "collaborator") return tasks.filter((task) => employeeId && task.collaborators?.includes(employeeId))
    if (activeList === "assigned") return tasks.filter((task) => employeeId && task.assignedToId === employeeId && !isSelfTask(task))
    if (activeList === "self") return tasks.filter(isSelfTask)
    return tasks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeList, employeeId, userId, tasks])

  const filtered = listScopedTasks.filter((task) => {
    const matchesTab = activeTab === "all" || task.status === activeTab
    const matchesProject = selectedProjectId === "all" || task.projectId === selectedProjectId
    const employee = employees.find((e) => e.id === task.assignedToId)
    const label = projectLabel(task).toLowerCase()
    const query = searchQuery.toLowerCase()
    const matchesSearch = !searchQuery ||
      task.title.toLowerCase().includes(query) ||
      (task.description ?? "").toLowerCase().includes(query) ||
      label.includes(query) ||
      (employee?.name ?? "").toLowerCase().includes(query)

    return matchesTab && matchesProject && matchesSearch
  })

  const counts = {
    all: listScopedTasks.length,
    pending: listScopedTasks.filter((task) => task.status === "pending").length,
    in_progress: listScopedTasks.filter((task) => task.status === "in_progress").length,
    completed: listScopedTasks.filter((task) => task.status === "completed").length,
    cancelled: listScopedTasks.filter((task) => task.status === "cancelled").length,
  }

  const listHeadings: Record<ListView, { title: string; subtitle: string }> = {
    all: {
      title: "All Tasks",
      subtitle: canManageTasks ? "Manage client projects and assign delivery work to your team." : "View and update your assigned tasks.",
    },
    assigned: { title: "Assigned to Me", subtitle: "Tasks assigned directly to you." },
    collaborator: { title: "My Collaborations", subtitle: "Tasks where you're a collaborator rather than the primary assignee." },
    self: { title: "Self Task", subtitle: "Tasks you assigned to yourself." },
  }

  const formatDate = (value: string) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const isOverdue = (task: Task) => task.dueDate && task.status !== "completed" && task.status !== "cancelled" && new Date(task.dueDate) < new Date()
  const isSelfTaskDialog = editTask ? isSelfTask(editTask) : activeList === "self"

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="h-fit rounded-xl border border-border/50 bg-card p-2 lg:sticky lg:top-4">
        <p className="px-2 pb-2 pt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">List</p>
        <div className="space-y-1">
          {listViews.map((view) => {
            const Icon = view.icon
            const count = listCounts[view.id]
            const active = activeList === view.id
            return (
              <button
                key={view.id}
                type="button"
                onClick={() => router.push(view.id === "all" ? "/tasks" : `/tasks?list=${view.id}`)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1 text-left truncate">{view.label}</span>
                {count > 0 && (
                  <span className={`grid min-w-5 place-items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </aside>

      <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{listHeadings[activeList].title}</h1>
          <p className="text-sm text-muted-foreground">{listHeadings[activeList].subtitle}</p>
        </div>
        {(canManageTasks || activeList === "self") && (
          <div className="flex gap-2 sm:shrink-0">
            <Button onClick={openAdd}>
              <Plus className="mr-2 size-4" />{activeList === "self" ? "Add Self Task" : "Assign Task"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {(["pending", "in_progress", "completed", "cancelled"] as TaskStatus[]).map((status) => {
          const cfg = statusConfig[status]
          const Icon = cfg.icon
          return (
            <Card key={status} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex size-9 items-center justify-center rounded-lg ${cfg.class.split(" ").map((c) => c.startsWith("bg-") ? c : "").join(" ")}`}>
                    <Icon className={`size-4 ${cfg.class.split(" ").find((c) => c.startsWith("text-"))}`} />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{counts[status]}</p>
                    <p className="text-xs text-muted-foreground">{cfg.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TaskStatus | "all")}>
              <TabsList>
                <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="in_progress">In Progress</TabsTrigger>
                <TabsTrigger value="completed">Done</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid gap-2 sm:grid-cols-[1fr_260px_220px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search title, client, project, assignee..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="All client projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All client projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.clientName} - {project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground flex items-center sm:justify-end">
                {projects.length > 0
                  ? `${projects.length} client project${projects.length === 1 ? "" : "s"}`
                  : "No client projects yet"}
              </div>
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
                const label = projectLabel(task)

                return (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => { setDetailTask(task); setDetailOpen(true) }}
                  >
                    <div className={`mt-1 size-2 rounded-full shrink-0 ${
                      task.priority === "urgent" ? "bg-destructive" :
                      task.priority === "high" ? "bg-warning" :
                      task.priority === "medium" ? "bg-info" : "bg-muted-foreground"
                    }`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                        {label && (
                          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 gap-1">
                            <BriefcaseBusiness className="size-3" />{label}
                          </Badge>
                        )}
                        <PriorityBadge priority={task.priority} />
                        <StatusBadge status={task.status} />
                        {overdue && <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">Overdue</Badge>}
                      </div>

                      {task.description && <p className="text-xs text-muted-foreground line-clamp-1 mb-1">{task.description}</p>}

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
                          <div className={`flex items-center gap-1 ${overdue ? "text-destructive" : ""}`}>
                            <CalendarIcon className="size-3" />
                            <span>Due {formatDate(task.dueDate)}</span>
                          </div>
                        )}
                        <span>Created {formatDate(task.createdAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-8 px-2 gap-1 text-muted-foreground hover:text-foreground"
                        onClick={(e) => { e.stopPropagation(); setDetailTask(task); setDetailOpen(true) }}>
                        <MessageSquare className="size-3.5" />
                        {task.commentCount ? <span className="text-xs">{task.commentCount}</span> : null}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 px-2 shrink-0">
                            <ChevronDown className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Update Status</div>
                          {statuses.map((status) => (
                            <DropdownMenuItem key={status} onClick={() => handleStatusChange(task, status)} className={task.status === status ? "bg-muted" : ""}>
                              {statusConfig[status].label}
                            </DropdownMenuItem>
                          ))}
                          {(canManageTasks || isSelfTask(task)) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openEdit(task)}>Edit Task</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeleteTask(task)}>
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

      <TaskDetailSheet
        task={detailTask}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        employeeName={employees.find((e) => e.id === detailTask?.assignedToId)?.name}
        employeeAvatar={employees.find((e) => e.id === detailTask?.assignedToId)?.avatar ?? undefined}
        employees={employees}
        isAdmin={canManageTasks || (detailTask ? isSelfTask(detailTask) : false)}
        onStatusChange={handleStatusChange}
        onEditTask={(task) => { setDetailOpen(false); openEdit(task) }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTask ? "Edit Task" : isSelfTaskDialog ? "Add Self Task" : "Assign Task"}</DialogTitle>
            <DialogDescription>
              {editTask
                ? "Update task details."
                : isSelfTaskDialog
                ? "Create a task assigned to yourself under a client project."
                : "Assign a task to a team member under a client project."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Client Project *</Label>
              <Select value={formProjectId} onValueChange={setFormProjectId}>
                <SelectTrigger><SelectValue placeholder="Select client project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>{project.clientName} - {project.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input placeholder="Task title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Optional description..." rows={3} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
            </div>
            {isSelfTaskDialog && !editTask && (
              !employeeId ? (
                <p className="text-xs text-destructive">Your account isn&apos;t linked to an employee profile, so you can&apos;t create self tasks. Ask an admin to link your login to an employee record.</p>
              ) : formProjectId && !assignableProjectMembers.some((employee) => employee.id === employeeId) ? (
                <p className="text-xs text-destructive">You&apos;re not a member of this project, so you can&apos;t self-assign a task here. Pick a project you belong to, or ask an admin to add you as a member.</p>
              ) : null
            )}
            <div className={isSelfTaskDialog ? "grid gap-3" : "grid grid-cols-2 gap-3"}>
              {!isSelfTaskDialog && (
                <div className="space-y-2">
                  <Label>Assign To *</Label>
                  {editTask ? (
                    <Select value={formAssignees[0] ?? ""} onValueChange={(value) => setFormAssignees([value])}>
                      <SelectTrigger><SelectValue placeholder={assignableProjectMembers.length === 0 ? "Add project members first" : "Select project member"} /></SelectTrigger>
                      <SelectContent>
                        {assignableProjectMembers.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            <div className="flex items-center gap-2">
                              <Avatar className="size-5"><AvatarImage src={employee.avatar} /><AvatarFallback className="text-[9px]">{employee.initials}</AvatarFallback></Avatar>
                              {employee.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-start font-normal" disabled={assignableProjectMembers.length === 0}>
                          {assignableProjectMembers.length === 0 ? "Add project members first" : formAssignees.length === 0 ? "Select project members" : `${formAssignees.length} selected`}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-64 max-h-56 overflow-y-auto">
                        {assignableProjectMembers.map((employee) => (
                          <DropdownMenuCheckboxItem
                            key={employee.id}
                            checked={formAssignees.includes(employee.id)}
                            onCheckedChange={(checked) => {
                              setFormAssignees((prev) =>
                                checked ? [...prev, employee.id] : prev.filter((id) => id !== employee.id)
                              )
                            }}
                          >
                            {employee.name}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {assignableProjectMembers.length === 0 && (
                    <p className="text-xs text-muted-foreground">Add members to this project before assigning a task.</p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={formPriority} onValueChange={(value) => setFormPriority(value as TaskPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {priorities.map((priority) => <SelectItem key={priority} value={priority}>{priorityConfig[priority].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!isSelfTaskDialog && (
              <div className="space-y-2">
                <Label>Collaborators</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-start font-normal" disabled={assignableProjectMembers.length === 0}>
                      {assignableProjectMembers.length === 0 ? "Add project members first" : formCollaboratorIds.length === 0 ? "Select collaborators" : `${formCollaboratorIds.length} selected`}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64 max-h-56 overflow-y-auto">
                    {assignableProjectMembers.map((employee) => (
                      <DropdownMenuCheckboxItem
                        key={employee.id}
                        checked={formCollaboratorIds.includes(employee.id)}
                        onCheckedChange={(checked) => toggleFormCollaborator(employee.id, checked === true)}
                      >
                        {employee.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <p className="text-xs text-muted-foreground">Optional teammates who help on this task alongside the assignee.</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!formTitle.trim() || formAssignees.length === 0 || !formProjectId}>
              {editTask ? "Update Task" : "Assign Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTask} onOpenChange={(open) => !open && setDeleteTask(null)}>
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
      </div>
    </div>
  )
}

export default function TasksPage() {
  return (
    <DashboardLayout>
      <TasksPageContent />
    </DashboardLayout>
  )
}
