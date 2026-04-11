"use client"

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import {
  BriefcaseBusiness,
  CalendarIcon,
  ClipboardList,
  FolderKanban,
  Info,
  Plus,
  Search,
  TableProperties,
  Trash2,
  Users,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/dashboard-layout"
import { TaskDetailSheet } from "@/components/task-detail-sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useHR } from "@/lib/hr-context"
import { cn } from "@/lib/utils"
import type { ClientProject, Employee, ProjectStatus, Task, TaskPriority, TaskStatus } from "@/lib/types"

type ProjectWithCount = ClientProject & { _count?: { tasks: number } }
type ViewMode = "tasks" | "table" | "info"

const defaultStages = ["Unstaged Tasks", "Onboarding", "Google My Business", "GTM", "Strategy Meet", "Copywriting", "Client Syncup"]

const priorityClasses: Record<TaskPriority, string> = {
  low: "border-border bg-muted text-muted-foreground",
  medium: "border-primary/20 bg-primary/10 text-primary",
  high: "border-warning/20 bg-warning/10 text-warning",
  urgent: "border-destructive/20 bg-destructive/10 text-destructive",
}

const projectStatuses: Record<ProjectStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  completed: "Completed",
  on_hold: "On Hold",
}

const taskStatuses: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
}

function formatDate(value?: string | null) {
  if (!value) return "No due date"
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function getProgress(tasks: Task[]) {
  if (!tasks.length) return 0
  return Math.round((tasks.filter((task) => task.status === "completed").length / tasks.length) * 100)
}

function Chip({ className, children }: { className: string; children: ReactNode }) {
  return <Badge variant="outline" className={cn("rounded-full px-2.5 py-1 text-xs", className)}>{children}</Badge>
}

function getFallbackProjectMembers(projectId: string, tasks: Task[], employees: Employee[]) {
  return Array.from(new Set(tasks.filter((task) => task.projectId === projectId).map((task) => task.assignedToId)))
    .map((employeeId) => employees.find((employee) => employee.id === employeeId))
    .filter((employee): employee is Employee => Boolean(employee))
}

function getProjectMembers(project: ProjectWithCount, tasks: Task[], employees: Employee[]) {
  const explicitMembers = (project.members ?? [])
    .map((member) => employees.find((employee) => employee.id === member.employee.id) ?? member.employee)
    .filter((employee): employee is Employee => Boolean(employee))

  if (explicitMembers.length > 0) return explicitMembers
  return getFallbackProjectMembers(project.id, tasks, employees)
}

function MemberSelector({
  employees,
  selectedIds,
  onToggle,
}: {
  employees: Employee[]
  selectedIds: string[]
  onToggle: (employeeId: string, checked: boolean) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Project Members</Label>
        <span className="text-xs text-muted-foreground">{selectedIds.length} selected</span>
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-border bg-muted/30 p-3">
        {employees.map((employee) => (
          <label key={employee.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 p-3 transition-colors hover:bg-accent/60">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar className="size-9">
                <AvatarImage src={employee.avatar} />
                <AvatarFallback className="bg-primary/15 text-[10px] text-primary">{employee.initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{employee.name}</p>
                <p className="text-xs text-muted-foreground">{employee.role} / {employee.department}</p>
              </div>
            </div>
            <Checkbox checked={selectedIds.includes(employee.id)} onCheckedChange={(checked) => onToggle(employee.id, checked === true)} />
          </label>
        ))}
      </div>
    </div>
  )
}

function ProjectsPageContent() {
  const { data: session } = useSession()
  const { employees } = useHR()
  const isAdmin = session?.user?.role === "ADMIN"
  const canManageProjects = isAdmin || session?.user?.role === "MANAGER"

  const [projects, setProjects] = useState<ProjectWithCount[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [projectQuery, setProjectQuery] = useState("")
  const [taskQuery, setTaskQuery] = useState("")
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [selectedStage, setSelectedStage] = useState(defaultStages[0])
  const [viewMode, setViewMode] = useState<ViewMode>("tasks")
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [membersDialogOpen, setMembersDialogOpen] = useState(false)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [projectSaving, setProjectSaving] = useState(false)
  const [membersSaving, setMembersSaving] = useState(false)
  const [taskSaving, setTaskSaving] = useState(false)
  const [projectDeleting, setProjectDeleting] = useState(false)
  const [taskDeleting, setTaskDeleting] = useState(false)

  const [projectClientName, setProjectClientName] = useState("")
  const [projectName, setProjectName] = useState("")
  const [projectDescription, setProjectDescription] = useState("")
  const [projectDueDate, setProjectDueDate] = useState("")
  const [projectPriority, setProjectPriority] = useState<TaskPriority>("medium")
  const [projectMemberIds, setProjectMemberIds] = useState<string[]>([])

  const [taskTitle, setTaskTitle] = useState("")
  const [taskDescription, setTaskDescription] = useState("")
  const [taskAssigneeId, setTaskAssigneeId] = useState("")
  const [taskStage, setTaskStage] = useState(defaultStages[0])
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("medium")
  const [taskStatus, setTaskStatus] = useState<TaskStatus>("pending")
  const [taskDueDate, setTaskDueDate] = useState("")

  const loadProjects = useCallback(async () => {
    const response = await fetch("/api/projects")
    if (!response.ok) throw new Error("Failed to load projects")
    setProjects(await response.json())
  }, [])

  const loadTasks = useCallback(async () => {
    const response = await fetch("/api/tasks")
    if (!response.ok) throw new Error("Failed to load tasks")
    setTasks(await response.json())
  }, [])

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      try {
        await Promise.all([loadProjects(), loadTasks()])
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load projects workspace")
      } finally {
        setLoading(false)
      }
    }
    void loadAll()
  }, [loadProjects, loadTasks])

  const visibleProjects = useMemo(() => {
    const query = projectQuery.trim().toLowerCase()
    const allowed = canManageProjects
      ? projects
      : projects.filter((project) => {
          const isExplicitMember = project.members?.some((member) => member.employeeId === session?.user?.employeeId)
          const hasAssignedTask = tasks.some((task) => task.projectId === project.id && task.assignedToId === session?.user?.employeeId)
          return isExplicitMember || hasAssignedTask
        })

    return allowed.filter((project) =>
      !query ||
      project.name.toLowerCase().includes(query) ||
      project.clientName.toLowerCase().includes(query) ||
      (project.description ?? "").toLowerCase().includes(query)
    )
  }, [canManageProjects, projectQuery, projects, session?.user?.employeeId, tasks])

  useEffect(() => {
    if (!selectedProjectId && visibleProjects[0]) setSelectedProjectId(visibleProjects[0].id)
  }, [selectedProjectId, visibleProjects])

  const selectedProject = visibleProjects.find((project) => project.id === selectedProjectId) ?? null

  const selectedProjectTasks = useMemo(() => {
    if (!selectedProject) return []
    const query = taskQuery.trim().toLowerCase()
    return tasks.filter((task) => {
      if (task.projectId !== selectedProject.id) return false
      if (!query) return true
      const employee = employees.find((item) => item.id === task.assignedToId)
      return (
        task.title.toLowerCase().includes(query) ||
        (task.description ?? "").toLowerCase().includes(query) ||
        (task.stage ?? "").toLowerCase().includes(query) ||
        (employee?.name ?? "").toLowerCase().includes(query)
      )
    })
  }, [employees, selectedProject, taskQuery, tasks])

  const selectedProjectMembers = useMemo(() => {
    if (!selectedProject) return []
    return getProjectMembers(selectedProject, tasks, employees)
  }, [employees, selectedProject, tasks])

  const assignableProjectMembers = useMemo(() => {
    if (!selectedProject?.members?.length) return []

    return selectedProject.members
      .map((member) => employees.find((employee) => employee.id === member.employeeId) ?? member.employee)
      .filter((employee): employee is Employee => Boolean(employee))
  }, [employees, selectedProject])

  const visibleStages = useMemo(() => {
    const taskStages = selectedProjectTasks.map((task) => task.stage || defaultStages[0])
    return Array.from(new Set(taskStages))
  }, [selectedProjectTasks])

  const availableStages = useMemo(() => {
    const taskStages = tasks.map((task) => task.stage || defaultStages[0])
    return Array.from(new Set([...defaultStages, ...taskStages]))
  }, [tasks])

  useEffect(() => {
    if (visibleStages.length === 0) {
      setSelectedStage(defaultStages[0])
      return
    }

    if (!visibleStages.includes(selectedStage)) {
      setSelectedStage(visibleStages[0])
    }
  }, [selectedStage, visibleStages])

  const selectedStageTasks = selectedProjectTasks.filter((task) => (task.stage || defaultStages[0]) === selectedStage)
  const completedTasks = selectedProjectTasks.filter((task) => task.status === "completed").length

  const toggleProjectMember = (employeeId: string, checked: boolean) => {
    setProjectMemberIds((prev) =>
      checked ? (prev.includes(employeeId) ? prev : [...prev, employeeId]) : prev.filter((id) => id !== employeeId)
    )
  }

  const resetProjectForm = () => {
    setProjectClientName("")
    setProjectName("")
    setProjectDescription("")
    setProjectDueDate("")
    setProjectPriority("medium")
    setProjectMemberIds([])
  }

  const resetTaskForm = () => {
    setEditingTask(null)
    setTaskTitle("")
    setTaskDescription("")
    setTaskAssigneeId("")
    setTaskStage(visibleStages[0] ?? defaultStages[0])
    setTaskPriority("medium")
    setTaskStatus("pending")
    setTaskDueDate("")
  }
  const openMembersDialog = () => {
    if (!selectedProject) return
    const explicitIds = selectedProject.members?.map((member) => member.employeeId) ?? []
    const fallbackIds = getFallbackProjectMembers(selectedProject.id, tasks, employees).map((employee) => employee.id)
    setProjectMemberIds(explicitIds.length > 0 ? explicitIds : fallbackIds)
    setMembersDialogOpen(true)
  }

  const handleProjectCreate = async () => {
    if (!projectClientName.trim() || !projectName.trim()) {
      toast.error("Client name and project title are required")
      return
    }

    setProjectSaving(true)
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: projectClientName.trim(),
          name: projectName.trim(),
          description: projectDescription.trim() || null,
          dueDate: projectDueDate || null,
          priority: projectPriority,
          status: "in_progress",
          memberIds: projectMemberIds,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        toast.error(payload.error ?? "Failed to create project")
        return
      }

      await loadProjects()
      resetProjectForm()
      setProjectDialogOpen(false)
      setSelectedProjectId(payload.id)
      toast.success("Project created")
    } finally {
      setProjectSaving(false)
    }
  }

  const handleProjectMembersSave = async () => {
    if (!selectedProject) return

    setMembersSaving(true)
    try {
      const response = await fetch(`/api/projects/${selectedProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds: projectMemberIds }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(payload?.error ?? "Failed to update project members")
        return
      }

      await loadProjects()
      setMembersDialogOpen(false)
      toast.success("Project members updated")
    } finally {
      setMembersSaving(false)
    }
  }

  const handleTaskSave = async () => {
    if (!selectedProject || !taskTitle.trim() || !taskAssigneeId) {
      toast.error("Task title and assignee are required")
      return
    }

    setTaskSaving(true)
    try {
      const response = await fetch(editingTask ? `/api/tasks/${editingTask.id}` : "/api/tasks", {
        method: editingTask ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle.trim(),
          description: taskDescription.trim() || null,
          assignedToId: taskAssigneeId,
          priority: taskPriority,
          status: taskStatus,
          stage: taskStage,
          dueDate: taskDueDate || null,
          projectId: selectedProject.id,
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        toast.error(payload?.error ?? "Failed to save task")
        return
      }

      await loadTasks()
      resetTaskForm()
      setTaskDialogOpen(false)
      toast.success(editingTask ? "Task updated" : "Task created")
    } finally {
      setTaskSaving(false)
    }
  }

  const handleProjectDelete = async () => {
    if (!selectedProject) return
    const projectName = selectedProject.name
    setProjectDeleting(true)
    try {
      const response = await fetch(`/api/projects/${selectedProject.id}`, { method: "DELETE" })
      if (!response.ok) {
        toast.error("Failed to delete project")
        return
      }

      await Promise.all([loadProjects(), loadTasks()])
      setSelectedProjectId("")
      setMembersDialogOpen(false)
      setTaskDialogOpen(false)
      toast.success(`Project "${projectName}" deleted`)
    } finally {
      setProjectDeleting(false)
    }
  }

  const handleTaskDelete = async (task: Task) => {
    setTaskDeleting(true)
    try {
      const response = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" })
      if (!response.ok) {
        toast.error("Failed to delete task")
        return
      }
      await loadTasks()
      setTaskDialogOpen(false)
      resetTaskForm()
      toast.success("Task deleted")
    } finally {
      setTaskDeleting(false)
    }
  }

  const handleStatusChange = async (task: Task, status: TaskStatus) => {
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!response.ok) {
      toast.error("Failed to update task status")
      return
    }
    await loadTasks()
  }

  const moveTaskStage = async (task: Task, stage: string) => {
    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    })
    if (!response.ok) {
      toast.error("Failed to move task")
      return
    }
    await loadTasks()
  }

  const openEditTask = (task: Task) => {
    setEditingTask(task)
    setTaskTitle(task.title)
    setTaskDescription(task.description ?? "")
    setTaskAssigneeId(task.assignedToId)
    setTaskStage(task.stage || defaultStages[0])
    setTaskPriority(task.priority)
    setTaskStatus(task.status)
    setTaskDueDate(task.dueDate ?? "")
    setTaskDialogOpen(true)
  }

  useEffect(() => {
    if (!taskDialogOpen) return
    if (assignableProjectMembers.length === 0) {
      setTaskAssigneeId("")
      return
    }

    const hasSelectedAssignee = assignableProjectMembers.some((employee) => employee.id === taskAssigneeId)
    if (!hasSelectedAssignee) {
      setTaskAssigneeId(editingTask?.assignedToId && assignableProjectMembers.some((employee) => employee.id === editingTask.assignedToId)
        ? editingTask.assignedToId
        : "")
    }
  }, [assignableProjectMembers, editingTask?.assignedToId, taskAssigneeId, taskDialogOpen])

  if (loading) {
    return <div className="grid min-h-[70vh] place-items-center rounded-[28px] border bg-card text-muted-foreground">Loading projects workspace...</div>
  }

  return (
    <>
      <div className="grid gap-4 lg:gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-[28px] border bg-card text-card-foreground shadow-sm">
          <div className="border-b p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="grid size-9 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><FolderKanban className="size-4" /></div>
                <div>
                  <p className="text-2xl font-semibold">Projects</p>
                  <p className="text-sm text-muted-foreground">Client delivery workspace</p>
                </div>
              </div>
              {canManageProjects && <Button size="icon" className="rounded-full" onClick={() => { resetProjectForm(); setProjectDialogOpen(true) }}><Plus className="size-5" /></Button>}
            </div>
            <div className="mt-4 rounded-2xl border bg-muted/30 p-4">
              <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground"><span>Portfolio progress</span><span>{completedTasks}/{selectedProjectTasks.length}</span></div>
              <Progress value={getProgress(selectedProjectTasks)} className="h-3 bg-muted" />
            </div>
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={projectQuery} onChange={(event) => setProjectQuery(event.target.value)} placeholder="Search projects..." className="rounded-xl bg-background pl-9" />
            </div>
          </div>

          <div className="space-y-3 p-3 sm:max-h-[68vh] sm:overflow-y-auto">
            {visibleProjects.map((project) => {
              const projectTasks = tasks.filter((task) => task.projectId === project.id)
              const projectMembers = getProjectMembers(project, tasks, employees)
              return (
                <button key={project.id} type="button" onClick={() => setSelectedProjectId(project.id)} className={cn("w-full rounded-[26px] border p-4 text-left transition-all duration-200", selectedProjectId === project.id ? "border-primary/30 bg-primary/10 shadow-[0_12px_32px_rgba(16,185,129,0.08)]" : "bg-background/80 hover:border-primary/20 hover:bg-accent/40")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-semibold">{project.name}</p>
                      <p className="text-sm text-muted-foreground">{project.clientName}</p>
                      <Chip className="mt-3 border-border bg-muted/50 text-foreground">{projectStatuses[project.status]}</Chip>
                    </div>
                    <Chip className={priorityClasses[project.priority]}>{project.priority}</Chip>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex -space-x-2">
                      {projectMembers.slice(0, 4).map((employee) => (
                        <Avatar key={employee.id} className="size-8 border-2 border-card">
                          <AvatarImage src={employee.avatar} />
                          <AvatarFallback className="bg-primary/15 text-[10px] text-primary">{employee.initials ?? "NA"}</AvatarFallback>
                        </Avatar>
                      ))}
                      {projectMembers.length === 0 && <span className="text-xs text-muted-foreground">No members</span>}
                    </div>
                    <div className="flex items-center gap-1"><CalendarIcon className="size-4" /><span>{formatDate(project.dueDate)}</span></div>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">{projectMembers.length} member{projectMembers.length === 1 ? "" : "s"}</div>
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between text-sm"><span>{projectTasks.filter((task) => task.status === "completed").length}/{projectTasks.length || project._count?.tasks || 0}</span><span>{getProgress(projectTasks)}%</span></div>
                    <Progress value={getProgress(projectTasks)} className="h-3 bg-muted" />
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="overflow-hidden rounded-[28px] border bg-card text-card-foreground shadow-sm">
          {!selectedProject ? (
            <div className="grid min-h-[70vh] place-items-center p-8 text-muted-foreground">Select a project to open its workspace.</div>
          ) : (
            <>
              <div className="border-b px-4 py-5 sm:px-6">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground"><BriefcaseBusiness className="size-4" /><span>{selectedProject.clientName}</span></div>
                    <h1 className="mt-2 text-3xl font-semibold">{selectedProject.name}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">{selectedProject.description || "Plan, assign, and track delivery in one place."}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {selectedProjectMembers.map((employee) => (
                        <div key={employee.id} className="flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1.5 text-xs text-foreground">
                          <Avatar className="size-6">
                            <AvatarImage src={employee.avatar} />
                            <AvatarFallback className="bg-primary/15 text-[9px] text-primary">{employee.initials}</AvatarFallback>
                          </Avatar>
                          <span>{employee.name}</span>
                        </div>
                      ))}
                      {selectedProjectMembers.length === 0 && <span className="text-sm text-muted-foreground">No project members yet.</span>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 xl:max-w-[420px] xl:justify-end">
                    <Button variant={viewMode === "tasks" ? "default" : "outline"} onClick={() => setViewMode("tasks")}><ClipboardList className="mr-2 size-4" />Tasks</Button>
                    <Button variant={viewMode === "table" ? "default" : "outline"} onClick={() => setViewMode("table")}><TableProperties className="mr-2 size-4" />Table</Button>
                    <Button variant={viewMode === "info" ? "default" : "outline"} onClick={() => setViewMode("info")}><Info className="mr-2 size-4" />Info</Button>
                    {canManageProjects && <Button variant="outline" className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary" onClick={openMembersDialog}><Users className="mr-2 size-4" />Members</Button>}
                    {canManageProjects && <Button variant="destructive" onClick={() => void handleProjectDelete()} loading={projectDeleting}><Trash2 className="mr-2 size-4" />Delete Project</Button>}
                    {canManageProjects && <Button onClick={() => { resetTaskForm(); setTaskDialogOpen(true) }}><Plus className="mr-2 size-4" />Add Task</Button>}
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-6">
                {viewMode === "tasks" && (
                  <div className="space-y-5">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                      <div className="grid w-full gap-3 sm:grid-cols-2 xl:flex xl:w-auto xl:flex-wrap">
                        {visibleStages.map((stage) => {
                          const stageTasks = selectedProjectTasks.filter((task) => (task.stage || defaultStages[0]) === stage)
                          return <button key={stage} type="button" onClick={() => setSelectedStage(stage)} className={cn("rounded-2xl border px-4 py-3 text-left transition-colors", selectedStage === stage ? "border-primary/30 bg-primary/10" : "bg-background/80 hover:border-primary/20 hover:bg-accent/40")}><p className="font-semibold">{stage}</p><p className="text-sm text-muted-foreground">{stageTasks.filter((task) => task.status === "completed").length}/{stageTasks.length} tasks</p></button>
                        })}
                      </div>
                      <div className="relative w-full xl:w-[280px]"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={taskQuery} onChange={(event) => setTaskQuery(event.target.value)} placeholder="Search tasks..." className="bg-background pl-9" /></div>
                    </div>
                    <div className="space-y-3 rounded-[26px] border bg-muted/20 p-3">
                      {visibleStages.length === 0 ? <div className="rounded-2xl border border-dashed bg-background/70 p-8 text-center text-muted-foreground">No stages created yet. Create a task to show its stage here.</div> : selectedStageTasks.length === 0 ? <div className="rounded-2xl border border-dashed bg-background/70 p-8 text-center text-muted-foreground">No tasks in this stage yet.</div> : selectedStageTasks.map((task) => {
                        const employee = employees.find((item) => item.id === task.assignedToId)
                        return <div key={task.id} className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate text-lg font-semibold">{task.title}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{employee?.name ?? "Unassigned"}</span><span>/</span><span>{formatDate(task.dueDate)}</span><span>/</span><span>{taskStatuses[task.status]}</span></div></div>{canManageProjects && <Select value={task.stage || defaultStages[0]} onValueChange={(value) => moveTaskStage(task, value)}><SelectTrigger className="w-[180px] bg-background"><SelectValue /></SelectTrigger><SelectContent>{availableStages.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}</SelectContent></Select>}<Button variant="ghost" className="text-primary hover:text-primary" onClick={() => { setDetailTask(task); setDetailOpen(true) }}>Open</Button>{canManageProjects && <Button variant="ghost" onClick={() => openEditTask(task)}>Edit</Button>}</div>
                      })}
                    </div>
                  </div>
                )}

                {viewMode === "table" && (
                  <div className="overflow-x-auto rounded-[24px] border bg-card p-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-muted-foreground">Task</TableHead>
                          <TableHead className="text-muted-foreground">Stage</TableHead>
                          <TableHead className="text-muted-foreground">Assignee</TableHead>
                          <TableHead className="text-muted-foreground">Priority</TableHead>
                          <TableHead className="text-muted-foreground">Status</TableHead>
                          <TableHead className="text-muted-foreground">Due</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedProjectTasks.map((task) => {
                          const employee = employees.find((member) => member.id === task.assignedToId)
                          return <TableRow key={task.id}><TableCell className="font-medium text-foreground">{task.title}</TableCell><TableCell className="text-muted-foreground">{task.stage || defaultStages[0]}</TableCell><TableCell className="text-muted-foreground">{employee?.name ?? "Unassigned"}</TableCell><TableCell><Chip className={priorityClasses[task.priority]}>{task.priority}</Chip></TableCell><TableCell className="text-muted-foreground">{taskStatuses[task.status]}</TableCell><TableCell className="text-muted-foreground">{formatDate(task.dueDate)}</TableCell></TableRow>
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {viewMode === "info" && (
                  <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                    <Card><CardHeader><CardTitle>Project Information</CardTitle></CardHeader><CardContent className="space-y-4 text-sm text-muted-foreground"><div><p className="text-muted-foreground">Client</p><p className="mt-1 text-foreground">{selectedProject.clientName}</p></div><div><p className="text-muted-foreground">Project Title</p><p className="mt-1 text-foreground">{selectedProject.name}</p></div><div><p className="text-muted-foreground">Description</p><p className="mt-1">{selectedProject.description || "No description added yet."}</p></div><div className="grid gap-4 md:grid-cols-2"><div><p className="text-muted-foreground">Due Date</p><p className="mt-1 text-foreground">{formatDate(selectedProject.dueDate)}</p></div><div><p className="text-muted-foreground">Status</p><p className="mt-1 text-foreground">{projectStatuses[selectedProject.status]}</p></div></div></CardContent></Card>
                    <Card><CardHeader><CardTitle>Project Snapshot</CardTitle></CardHeader><CardContent className="space-y-4"><div className="rounded-2xl border bg-muted/30 p-4"><p className="text-sm text-muted-foreground">Progress</p><p className="mt-1 text-3xl font-semibold">{getProgress(selectedProjectTasks)}%</p></div><div className="rounded-2xl border bg-muted/30 p-4"><p className="text-sm text-muted-foreground">Project Members</p><p className="mt-1 text-3xl font-semibold">{selectedProjectMembers.length}</p></div><div className="rounded-2xl border bg-muted/30 p-4"><p className="text-sm text-muted-foreground">Member Profiles</p><div className="mt-3 space-y-3">{selectedProjectMembers.length === 0 ? <p className="text-sm text-muted-foreground">No members added yet.</p> : selectedProjectMembers.map((employee) => <div key={employee.id} className="flex items-center gap-3"><Avatar className="size-10"><AvatarImage src={employee.avatar} /><AvatarFallback className="bg-primary/15 text-xs text-primary">{employee.initials}</AvatarFallback></Avatar><div><p className="font-medium text-foreground">{employee.name}</p><p className="text-xs text-muted-foreground">{employee.role} / {employee.department}</p></div></div>)}</div></div></CardContent></Card>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      <TaskDetailSheet task={detailTask} open={detailOpen} onOpenChange={setDetailOpen} employeeName={employees.find((employee) => employee.id === detailTask?.assignedToId)?.name} employeeAvatar={employees.find((employee) => employee.id === detailTask?.assignedToId)?.avatar ?? undefined} isAdmin={canManageProjects} onStatusChange={handleStatusChange} onEditTask={(task) => { setDetailOpen(false); openEditTask(task) }} />

      <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
        <DialogContent className="max-w-3xl sm:max-h-[90vh] sm:overflow-y-auto">
          <DialogHeader><DialogTitle className="text-center text-3xl font-semibold">Create New Project</DialogTitle><DialogDescription className="text-center">Add project details, assign members, and start delivery work right away.</DialogDescription></DialogHeader>
          <div className="grid gap-5 py-4">
            <div className="grid gap-5 md:grid-cols-2"><div className="space-y-2"><Label>Client Name*</Label><Input value={projectClientName} onChange={(event) => setProjectClientName(event.target.value)} placeholder="Enter Client Name" className="h-12 bg-background" /></div><div className="space-y-2"><Label>Project Title*</Label><Input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Enter Project Title" className="h-12 bg-background" /></div></div>
            <div className="space-y-2"><Label>Project Description</Label><Textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} placeholder="Enter Project Description" rows={4} className="bg-background" /></div>
            <div className="grid gap-5 md:grid-cols-2"><div className="space-y-2"><Label>Project Due Date</Label><Input type="date" value={projectDueDate} onChange={(event) => setProjectDueDate(event.target.value)} className="h-12 bg-background" /></div><div className="space-y-2"><Label>Priority</Label><Select value={projectPriority} onValueChange={(value) => setProjectPriority(value as TaskPriority)}><SelectTrigger className="h-12 bg-background"><SelectValue /></SelectTrigger><SelectContent>{Object.keys(priorityClasses).map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent></Select></div></div>
            <MemberSelector employees={employees} selectedIds={projectMemberIds} onToggle={toggleProjectMember} />
          </div>
          <DialogFooter className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Button type="button" variant="outline" className="h-12 border-warning/20 bg-warning/10 text-warning hover:bg-warning/15 hover:text-warning" onClick={() => { setProjectPriority("high"); toast.success("Template applied: default delivery stages are ready.") }} disabled={projectSaving}>Use Template</Button><Button type="button" className="h-12" onClick={handleProjectCreate} loading={projectSaving}>Next</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={membersDialogOpen} onOpenChange={setMembersDialogOpen}>
        <DialogContent className="max-w-2xl sm:max-h-[90vh] sm:overflow-y-auto">
          <DialogHeader><DialogTitle>Manage Project Members</DialogTitle><DialogDescription>{selectedProject ? `Add or remove members for ${selectedProject.name}.` : "Select a project first."}</DialogDescription></DialogHeader>
          <div className="py-3"><MemberSelector employees={employees} selectedIds={projectMemberIds} onToggle={toggleProjectMember} /></div>
          <DialogFooter className="flex items-center gap-3"><Button type="button" variant="outline" onClick={() => setMembersDialogOpen(false)} disabled={membersSaving}>Cancel</Button><Button type="button" onClick={handleProjectMembersSave} loading={membersSaving}>Save Members</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-2xl sm:max-h-[90vh] sm:overflow-y-auto">
          <DialogHeader><DialogTitle>{editingTask ? "Edit Task" : "Create Task"}</DialogTitle><DialogDescription>{selectedProject ? `This task will be added to ${selectedProject.name}.` : "Select a project first."}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="space-y-2"><Label>Task Title*</Label><Input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Enter task title" className="bg-background" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} placeholder="Add task context" rows={4} className="bg-background" /></div>
            <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Stage</Label><Select value={taskStage} onValueChange={setTaskStage}><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger><SelectContent>{availableStages.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Assignee*</Label><Select value={taskAssigneeId} onValueChange={setTaskAssigneeId} disabled={assignableProjectMembers.length === 0}><SelectTrigger className="bg-background"><SelectValue placeholder={assignableProjectMembers.length === 0 ? "Add project members first" : "Select project member"} /></SelectTrigger><SelectContent>{assignableProjectMembers.map((employee) => <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>)}</SelectContent></Select>{assignableProjectMembers.length === 0 && <p className="text-xs text-muted-foreground">Add members to this project before assigning a task.</p>}</div></div>
            <div className="grid gap-4 md:grid-cols-3"><div className="space-y-2"><Label>Priority</Label><Select value={taskPriority} onValueChange={(value) => setTaskPriority(value as TaskPriority)}><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger><SelectContent>{Object.keys(priorityClasses).map((priority) => <SelectItem key={priority} value={priority}>{priority}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Status</Label><Select value={taskStatus} onValueChange={(value) => setTaskStatus(value as TaskStatus)}><SelectTrigger className="bg-background"><SelectValue /></SelectTrigger><SelectContent>{Object.keys(taskStatuses).map((status) => <SelectItem key={status} value={status}>{taskStatuses[status as TaskStatus]}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Due Date</Label><Input type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} className="bg-background" /></div></div>
          </div>
          <DialogFooter className="flex items-center justify-between gap-3"><div>{editingTask && canManageProjects && <Button type="button" variant="destructive" onClick={() => void handleTaskDelete(editingTask)} loading={taskDeleting}><Trash2 className="mr-2 size-4" />Delete</Button>}</div><div className="flex flex-wrap items-center gap-2 sm:gap-3 xl:max-w-[420px] xl:justify-end"><Button type="button" variant="outline" onClick={() => { setTaskDialogOpen(false); resetTaskForm() }} disabled={taskSaving || taskDeleting}>Cancel</Button><Button type="button" onClick={handleTaskSave} loading={taskSaving}>{editingTask ? "Update Task" : "Create Task"}</Button></div></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function ProjectsPage() {
  return <DashboardLayout><ProjectsPageContent /></DashboardLayout>
}
