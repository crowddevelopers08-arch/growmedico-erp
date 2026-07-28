/**
 * The option sets a project falls back to when the create wizard is run without
 * a template, and the shape the wizard/templates fill in. Kept in one place so
 * the seed script, the API and the wizard can't drift apart.
 */

export type AttributeScope = "project" | "task"
export type AttributeKind = "status" | "tag" | "priority"

export interface AttributeOption {
  name: string
  color: string
  isTerminal?: boolean
}

export interface StageOption {
  name: string
  color: string
}

export const FALLBACK_STAGE = "Unstaged Tasks"

/** Palette the wizard offers for stages and attribute chips. */
export const OPTION_COLORS = [
  "#64748b",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#0ea5e9",
] as const

/**
 * The four task statuses the app shipped with. Existing rows store these exact
 * names in Task.status, so they stay the default set for every project.
 */
export const DEFAULT_TASK_STATUSES: AttributeOption[] = [
  { name: "pending", color: "#64748b" },
  { name: "in_progress", color: "#3b82f6" },
  { name: "completed", color: "#22c55e", isTerminal: true },
  { name: "cancelled", color: "#ef4444", isTerminal: true },
]

export const DEFAULT_PROJECT_STATUSES: AttributeOption[] = [
  { name: "open", color: "#64748b" },
  { name: "in_progress", color: "#3b82f6" },
  { name: "completed", color: "#22c55e", isTerminal: true },
  { name: "on_hold", color: "#eab308" },
]

export const DEFAULT_PRIORITIES: AttributeOption[] = [
  { name: "low", color: "#64748b" },
  { name: "medium", color: "#3b82f6" },
  { name: "high", color: "#f97316" },
  { name: "urgent", color: "#ef4444" },
]

export const DEFAULT_TAGS: AttributeOption[] = []

/** Every default option set, ready to be written as ProjectAttribute rows. */
export function defaultAttributeRows(): Array<
  AttributeOption & { scope: AttributeScope; kind: AttributeKind; orderIndex: number }
> {
  const rows: Array<AttributeOption & { scope: AttributeScope; kind: AttributeKind; orderIndex: number }> = []
  const push = (scope: AttributeScope, kind: AttributeKind, options: AttributeOption[]) => {
    options.forEach((option, index) => rows.push({ ...option, scope, kind, orderIndex: index }))
  }

  push("project", "status", DEFAULT_PROJECT_STATUSES)
  push("project", "priority", DEFAULT_PRIORITIES)
  push("project", "tag", DEFAULT_TAGS)
  push("task", "status", DEFAULT_TASK_STATUSES)
  push("task", "priority", DEFAULT_PRIORITIES)
  push("task", "tag", DEFAULT_TAGS)

  return rows
}

/** Human labels for the status/priority names stored in the database. */
export const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  open: "Open",
  on_hold: "On Hold",
}

export function labelFor(name: string) {
  return STATUS_LABELS[name] ?? name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
