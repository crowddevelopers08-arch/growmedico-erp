"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  GripVertical,
  LayoutTemplate,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { ProjectTemplateGallery } from "@/components/project-template-gallery"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  DEFAULT_PRIORITIES,
  DEFAULT_PROJECT_STATUSES,
  DEFAULT_TASK_STATUSES,
  FALLBACK_STAGE,
  OPTION_COLORS,
  labelFor,
} from "@/lib/project-defaults"
import { cn } from "@/lib/utils"
import type { AttributeKind, AttributeScope, ClientProject, Employee, ProjectTemplate } from "@/lib/types"

interface OptionRow {
  name: string
  color: string
  isTerminal?: boolean
}

interface StageRow {
  name: string
  color: string
}

interface WizardState {
  clientName: string
  name: string
  description: string
  startDate: string
  dueDate: string
  priority: string
  status: string
  visibility: "public" | "private"
  ownerId: string
  defaultAssigneeId: string
  memberIds: string[]
  projectStatuses: OptionRow[]
  projectTags: OptionRow[]
  projectPriorities: OptionRow[]
  taskStatuses: OptionRow[]
  taskTags: OptionRow[]
  taskPriorities: OptionRow[]
  stages: StageRow[]
  templateId: string | null
  templateName: string | null
}

const STEPS = [
  { id: 1, title: "Project details", hint: "Name the project and set its due date." },
  { id: 2, title: "Project attributes", hint: "Statuses, tags and priorities for the project itself." },
  { id: 3, title: "Task attributes", hint: "Statuses, tags and priorities that tasks can use." },
  { id: 4, title: "Members", hint: "Who can see the project, who owns it, who gets tasks by default." },
  { id: 5, title: "Workflow stages", hint: "The ordered pipeline your tasks move through." },
  { id: 6, title: "Review", hint: "Check everything, then create the project." },
] as const

const DEFAULT_STAGES: StageRow[] = [{ name: FALLBACK_STAGE, color: "#64748b" }]

function initialState(): WizardState {
  return {
    clientName: "",
    name: "",
    description: "",
    startDate: "",
    dueDate: "",
    priority: "medium",
    status: "open",
    visibility: "public",
    ownerId: "",
    defaultAssigneeId: "",
    memberIds: [],
    projectStatuses: DEFAULT_PROJECT_STATUSES.map((option) => ({ ...option })),
    projectTags: [],
    projectPriorities: DEFAULT_PRIORITIES.map((option) => ({ ...option })),
    taskStatuses: DEFAULT_TASK_STATUSES.map((option) => ({ ...option })),
    taskTags: [],
    taskPriorities: DEFAULT_PRIORITIES.map((option) => ({ ...option })),
    stages: DEFAULT_STAGES.map((stage) => ({ ...stage })),
    templateId: null,
    templateName: null,
  }
}

function Dot({ color }: { color: string }) {
  return <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
}

/** Colour picker rendered as a row of swatches — no native colour input. */
function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {OPTION_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Use colour ${color}`}
          onClick={() => onChange(color)}
          className={cn(
            "size-5 rounded-full border-2 transition-transform hover:scale-110",
            value.toLowerCase() === color.toLowerCase() ? "border-foreground" : "border-transparent"
          )}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  )
}

/**
 * Editable list of named, coloured options. Used for all six attribute lists and
 * (with reordering enabled) for the workflow stages.
 */
function OptionListEditor({
  label,
  hint,
  options,
  onChange,
  reorderable = false,
  allowTerminal = false,
  minimum = 0,
}: {
  label: string
  hint?: string
  options: OptionRow[]
  onChange: (next: OptionRow[]) => void
  reorderable?: boolean
  allowTerminal?: boolean
  minimum?: number
}) {
  const [draft, setDraft] = useState("")

  const add = () => {
    const name = draft.trim()
    if (!name) return
    if (options.some((option) => option.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`"${name}" is already in this list`)
      return
    }
    onChange([...options, { name, color: OPTION_COLORS[options.length % OPTION_COLORS.length] }])
    setDraft("")
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= options.length) return
    const next = [...options]
    const [row] = next.splice(index, 1)
    next.splice(target, 0, row)
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">{options.length} option{options.length === 1 ? "" : "s"}</span>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={`${option.name}-${index}`} className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-2.5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {reorderable && <GripVertical className="size-4 shrink-0 text-muted-foreground" />}
              <Dot color={option.color} />
              <span className="min-w-0 flex-1 text-sm wrap-break-word">{labelFor(option.name)}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ColorPicker
                value={option.color}
                onChange={(color) => {
                  const next = [...options]
                  next[index] = { ...option, color }
                  onChange(next)
                }}
              />

              {allowTerminal && (
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox
                    checked={option.isTerminal === true}
                    onCheckedChange={(checked) => {
                      const next = [...options]
                      next[index] = { ...option, isTerminal: checked === true }
                      onChange(next)
                    }}
                  />
                  Done
                </label>
              )}

              {reorderable && (
                <div className="flex">
                  <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => move(index, -1)} disabled={index === 0}>
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => move(index, 1)}
                    disabled={index === options.length - 1}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-destructive"
                onClick={() => onChange(options.filter((_, i) => i !== index))}
                disabled={options.length <= minimum}
                title={options.length <= minimum ? `Keep at least ${minimum}` : "Remove"}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}

        {options.length === 0 && (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            Nothing added yet.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              add()
            }
          }}
          placeholder={`Add ${label.toLowerCase()}...`}
        />
        <Button type="button" variant="outline" onClick={add} className="w-full sm:w-auto">
          <Plus className="size-4" /> Add
        </Button>
      </div>
    </div>
  )
}

export function ProjectWizard({
  open,
  onOpenChange,
  employees,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: Employee[]
  onCreated: (project: ClientProject) => void
}) {
  const [step, setStep] = useState(1)
  const [state, setState] = useState<WizardState>(initialState)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Reset whenever the wizard is reopened so a cancelled run never leaks into
  // the next one.
  useEffect(() => {
    if (open) {
      setStep(1)
      setState(initialState())
    }
  }, [open])

  const patch = useCallback((partial: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...partial }))
  }, [])

  /**
   * Pull a template's stages and task statuses/tags into the wizard. Everything
   * stays editable — this only pre-fills steps 2, 3 and 5.
   */
  const applyTemplate = useCallback((template: ProjectTemplate) => {
    setState((prev) => {
      const taskStatuses = template.attributes
        .filter((attribute) => attribute.scope === "task" && attribute.kind === "status")
        .map((attribute) => ({ name: attribute.name, color: attribute.color, isTerminal: attribute.isTerminal }))
      const taskTags = template.attributes
        .filter((attribute) => attribute.scope === "task" && attribute.kind === "tag")
        .map((attribute) => ({ name: attribute.name, color: attribute.color }))
      const projectStatuses = template.attributes
        .filter((attribute) => attribute.scope === "project" && attribute.kind === "status")
        .map((attribute) => ({ name: attribute.name, color: attribute.color, isTerminal: attribute.isTerminal }))

      return {
        ...prev,
        templateId: template.id,
        templateName: template.name,
        stages: template.stages.length
          ? template.stages.map((stage) => ({ name: stage.name, color: stage.color }))
          : prev.stages,
        taskStatuses: taskStatuses.length ? taskStatuses : prev.taskStatuses,
        taskTags: taskTags.length ? taskTags : prev.taskTags,
        projectStatuses: projectStatuses.length ? projectStatuses : prev.projectStatuses,
      }
    })
    setGalleryOpen(false)
    toast.success(`Using "${template.name}" — stages and statuses pre-filled`)
  }, [])

  const clearTemplate = () => patch({ templateId: null, templateName: null })

  const stepValid = useMemo(() => {
    switch (step) {
      case 1:
        return state.clientName.trim().length > 0 && state.name.trim().length > 0
      case 2:
        return state.projectStatuses.length > 0 && state.projectPriorities.length > 0
      case 3:
        return state.taskStatuses.length > 0 && state.taskPriorities.length > 0
      case 5:
        return state.stages.length > 0
      default:
        return true
    }
  }, [step, state])

  const buildPayload = () => {
    const attributes: Array<{ scope: AttributeScope; kind: AttributeKind; name: string; color: string; isTerminal?: boolean }> = []
    const push = (scope: AttributeScope, kind: AttributeKind, rows: OptionRow[]) => {
      rows.forEach((row) => attributes.push({ scope, kind, name: row.name, color: row.color, isTerminal: row.isTerminal }))
    }

    push("project", "status", state.projectStatuses)
    push("project", "tag", state.projectTags)
    push("project", "priority", state.projectPriorities)
    push("task", "status", state.taskStatuses)
    push("task", "tag", state.taskTags)
    push("task", "priority", state.taskPriorities)

    return {
      clientName: state.clientName.trim(),
      name: state.name.trim(),
      description: state.description.trim() || null,
      startDate: state.startDate || null,
      dueDate: state.dueDate || null,
      priority: state.priority,
      status: state.status,
      visibility: state.visibility,
      ownerId: state.ownerId || null,
      defaultAssigneeId: state.defaultAssigneeId || null,
      memberIds: state.memberIds,
      stages: state.stages,
      attributes,
      templateId: state.templateId,
    }
  }

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? "Failed to create project")

      toast.success(
        state.templateName
          ? `${data.name} created from "${state.templateName}"`
          : `${data.name} created`
      )
      onCreated(data)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project")
    } finally {
      setSubmitting(false)
    }
  }

  const current = STEPS[step - 1]

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b px-4 py-4 sm:px-6">
            <DialogTitle className="text-xl sm:text-2xl">Create New Project</DialogTitle>
            <DialogDescription>
              Step {step} of {STEPS.length} — {current.hint}
            </DialogDescription>

            {/* Step rail. Collapses to a plain progress bar on narrow screens
                where six labelled dots would not fit. */}
            <div className="mt-3 flex items-center gap-1.5">
              {STEPS.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-colors",
                    item.id < step ? "bg-primary" : item.id === step ? "bg-primary/60" : "bg-muted"
                  )}
                  title={item.title}
                />
              ))}
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1">
            <div className="space-y-5 px-4 py-5 sm:px-6">
              {/* --- Step 1: details ------------------------------------- */}
              {step === 1 && (
                <>
                  {state.templateName ? (
                    <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
                      <Sparkles className="size-5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium wrap-break-word">Using template: {state.templateName}</p>
                        <p className="text-xs text-muted-foreground">
                          Its stages and statuses are pre-filled in the later steps, and its tasks will be added on create.
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={clearTemplate} className="shrink-0">
                        <X className="size-4" /> Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 rounded-2xl border border-dashed p-4 sm:flex-row sm:items-center">
                      <LayoutTemplate className="size-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Start from a template?</p>
                        <p className="text-xs text-muted-foreground">
                          Brings ready-made stages, statuses and starter tasks. Or skip and set it up yourself.
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setGalleryOpen(true)} className="shrink-0">
                        Use Template
                      </Button>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="wizard-client">Client name</Label>
                      <Input
                        id="wizard-client"
                        value={state.clientName}
                        onChange={(event) => patch({ clientName: event.target.value })}
                        placeholder="Acme Health"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wizard-name">Project title</Label>
                      <Input
                        id="wizard-name"
                        value={state.name}
                        onChange={(event) => patch({ name: event.target.value })}
                        placeholder="Q3 Growth Retainer"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="wizard-description">Description</Label>
                    <Textarea
                      id="wizard-description"
                      value={state.description}
                      onChange={(event) => patch({ description: event.target.value })}
                      placeholder="What is this project delivering?"
                      rows={3}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="wizard-start">Start date</Label>
                      <Input
                        id="wizard-start"
                        type="date"
                        value={state.startDate}
                        onChange={(event) => patch({ startDate: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wizard-due">Due date</Label>
                      <Input
                        id="wizard-due"
                        type="date"
                        value={state.dueDate}
                        onChange={(event) => patch({ dueDate: event.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* --- Step 2: project attributes -------------------------- */}
              {step === 2 && (
                <>
                  <OptionListEditor
                    label="Project status"
                    hint="The states this project moves through."
                    options={state.projectStatuses}
                    onChange={(next) => patch({ projectStatuses: next })}
                    allowTerminal
                    reorderable
                    minimum={1}
                  />
                  <OptionListEditor
                    label="Project tags"
                    hint="Optional labels for grouping projects."
                    options={state.projectTags}
                    onChange={(next) => patch({ projectTags: next })}
                  />
                  <OptionListEditor
                    label="Project priority"
                    options={state.projectPriorities}
                    onChange={(next) => patch({ projectPriorities: next })}
                    reorderable
                    minimum={1}
                  />
                </>
              )}

              {/* --- Step 3: task attributes ----------------------------- */}
              {step === 3 && (
                <>
                  <OptionListEditor
                    label="Task status"
                    hint="Tick 'Done' on any status that means the task is finished — progress and the dashboard use it."
                    options={state.taskStatuses}
                    onChange={(next) => patch({ taskStatuses: next })}
                    allowTerminal
                    reorderable
                    minimum={1}
                  />
                  <OptionListEditor
                    label="Task tags"
                    options={state.taskTags}
                    onChange={(next) => patch({ taskTags: next })}
                  />
                  <OptionListEditor
                    label="Task priority"
                    options={state.taskPriorities}
                    onChange={(next) => patch({ taskPriorities: next })}
                    reorderable
                    minimum={1}
                  />
                </>
              )}

              {/* --- Step 4: members ------------------------------------- */}
              {step === 4 && (
                <>
                  <div className="space-y-2">
                    <Label>Visibility</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {(["public", "private"] as const).map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => patch({ visibility: option })}
                          className={cn(
                            "rounded-2xl border p-3 text-left transition-colors",
                            state.visibility === option ? "border-primary bg-primary/5" : "hover:bg-accent/50"
                          )}
                        >
                          <p className="text-sm font-medium capitalize">{option}</p>
                          <p className="text-xs text-muted-foreground">
                            {option === "public"
                              ? "Anyone in the workspace can find and open it."
                              : "Only the members you add below can see it."}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Project owner</Label>
                      <Select value={state.ownerId || "none"} onValueChange={(value) => patch({ ownerId: value === "none" ? "" : value })}>
                        <SelectTrigger><SelectValue placeholder="Select an owner" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No owner</SelectItem>
                          {employees.map((employee) => (
                            <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Default assignee</Label>
                      <Select
                        value={state.defaultAssigneeId || "none"}
                        onValueChange={(value) => patch({ defaultAssigneeId: value === "none" ? "" : value })}
                      >
                        <SelectTrigger><SelectValue placeholder="Select an assignee" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No default</SelectItem>
                          {employees.map((employee) => (
                            <SelectItem key={employee.id} value={employee.id}>{employee.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        New tasks — including any brought in by a template — start assigned to this person.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Members</Label>
                      <span className="text-xs text-muted-foreground">{state.memberIds.length} selected</span>
                    </div>
                    <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border bg-muted/20 p-3">
                      {employees.map((employee) => (
                        <label
                          key={employee.id}
                          className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/70 p-3 transition-colors hover:bg-accent/60"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar className="size-9 shrink-0">
                              <AvatarImage src={employee.avatar} />
                              <AvatarFallback className="bg-primary/15 text-tiny text-primary">{employee.initials}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{employee.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {[employee.role, employee.department].filter(Boolean).join(" / ")}
                              </p>
                            </div>
                          </div>
                          <Checkbox
                            checked={state.memberIds.includes(employee.id)}
                            onCheckedChange={(checked) =>
                              patch({
                                memberIds:
                                  checked === true
                                    ? [...state.memberIds, employee.id]
                                    : state.memberIds.filter((id) => id !== employee.id),
                              })
                            }
                          />
                        </label>
                      ))}
                      {employees.length === 0 && (
                        <p className="py-6 text-center text-sm text-muted-foreground">No employees to add yet.</p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* --- Step 5: stages -------------------------------------- */}
              {step === 5 && (
                <OptionListEditor
                  label="Workflow stages"
                  hint="Tasks move left to right through these. They become the columns on the Kanban board."
                  options={state.stages}
                  onChange={(next) => patch({ stages: next.map(({ name, color }) => ({ name, color })) })}
                  reorderable
                  minimum={1}
                />
              )}

              {/* --- Step 6: review -------------------------------------- */}
              {step === 6 && (
                <div className="space-y-4">
                  <div className="rounded-2xl border p-4">
                    <p className="text-sm text-muted-foreground">Project</p>
                    <p className="mt-1 font-semibold wrap-break-word">
                      {state.clientName} — {state.name}
                    </p>
                    {state.description && (
                      <p className="mt-1 text-sm text-muted-foreground wrap-break-word">{state.description}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline" className="rounded-full capitalize">{labelFor(state.status)}</Badge>
                      <Badge variant="outline" className="rounded-full capitalize">{state.priority}</Badge>
                      <Badge variant="outline" className="rounded-full capitalize">{state.visibility}</Badge>
                      {state.dueDate && <Badge variant="outline" className="rounded-full">Due {state.dueDate}</Badge>}
                    </div>
                  </div>

                  {state.templateName && (
                    <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
                      <Sparkles className="size-4 shrink-0 text-primary" />
                      <span className="wrap-break-word">
                        Starter tasks from <strong>{state.templateName}</strong> will be created in this project.
                      </span>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border p-4">
                      <p className="text-sm text-muted-foreground">Stages ({state.stages.length})</p>
                      <div className="mt-2 space-y-1.5">
                        {state.stages.map((stage) => (
                          <div key={stage.name} className="flex items-center gap-2 text-sm">
                            <Dot color={stage.color} />
                            <span className="min-w-0 wrap-break-word">{stage.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border p-4">
                      <p className="text-sm text-muted-foreground">Task statuses ({state.taskStatuses.length})</p>
                      <div className="mt-2 space-y-1.5">
                        {state.taskStatuses.map((status) => (
                          <div key={status.name} className="flex items-center gap-2 text-sm">
                            <Dot color={status.color} />
                            <span className="min-w-0 wrap-break-word">{labelFor(status.name)}</span>
                            {status.isTerminal && <Check className="ml-auto size-3.5 shrink-0 text-success" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border p-4">
                    <p className="text-sm text-muted-foreground">Members ({state.memberIds.length})</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {state.memberIds.map((id) => {
                        const employee = employees.find((item) => item.id === id)
                        if (!employee) return null
                        return (
                          <Badge key={id} variant="outline" className="rounded-full">
                            {employee.name}
                          </Badge>
                        )
                      })}
                      {state.memberIds.length === 0 && (
                        <p className="text-sm text-muted-foreground">No members yet — you can add them later.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="flex flex-col gap-2 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <Button
              variant="ghost"
              onClick={() => (step === 1 ? onOpenChange(false) : setStep((value) => value - 1))}
              className="w-full sm:w-auto"
              disabled={submitting}
            >
              <ArrowLeft className="size-4" /> {step === 1 ? "Cancel" : "Back"}
            </Button>

            {step < STEPS.length ? (
              <Button
                onClick={() => setStep((value) => value + 1)}
                disabled={!stepValid}
                className="w-full sm:w-auto"
              >
                Next <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={submitting} className="w-full sm:w-auto">
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Create a Project
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ProjectTemplateGallery open={galleryOpen} onOpenChange={setGalleryOpen} onUseTemplate={applyTemplate} />
    </>
  )
}
