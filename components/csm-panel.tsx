"use client"

import { useMemo, useState } from "react"
import { Search, Users, ShieldAlert, ChevronRight, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ClientProject, Employee } from "@/lib/types"
import { CSM_DEPARTMENT } from "@/lib/permissions"
import { cn } from "@/lib/utils"

// A project's CSM is derived from its members rather than stored separately, so
// assigning a CSM to a project is just adding them as a member. The department
// constant lives in lib/permissions so server routes can use it too.
export { CSM_DEPARTMENT }

/** Sentinel id for the "projects with no CSM member" bucket. */
export const UNASSIGNED_CSM = "__unassigned__"

export function projectHasCsm(project: ClientProject) {
  return (project.members ?? []).some((member) => member.employee.department === CSM_DEPARTMENT)
}

export function projectBelongsToCsm(project: ClientProject, csmId: string) {
  if (csmId === UNASSIGNED_CSM) return !projectHasCsm(project)
  return (project.members ?? []).some((member) => member.employeeId === csmId)
}

interface CsmPanelProps {
  projects: ClientProject[]
  employees: Employee[]
  selectedCsmId: string | null
  onSelect: (csmId: string | null) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function CsmPanel({
  projects,
  employees,
  selectedCsmId,
  onSelect,
  collapsed = false,
  onToggleCollapse,
}: CsmPanelProps) {
  const [query, setQuery] = useState("")

  // Every CSM, including those with no projects yet, so gaps stay visible.
  const entries = useMemo(() => {
    return employees
      .filter((employee) => employee.department === CSM_DEPARTMENT)
      .map((employee) => {
        const owned = projects.filter((project) =>
          (project.members ?? []).some((member) => member.employeeId === employee.id),
        )
        return {
          employee,
          projects: owned,
          clients: Array.from(new Set(owned.map((project) => project.clientName))),
        }
      })
      .sort((a, b) => a.employee.name.localeCompare(b.employee.name))
  }, [employees, projects])

  const unassignedCount = useMemo(
    () => projects.filter((project) => !projectHasCsm(project)).length,
    [projects],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return entries
    return entries.filter(
      (entry) =>
        entry.employee.name.toLowerCase().includes(needle) ||
        entry.clients.some((client) => client.toLowerCase().includes(needle)),
    )
  }, [entries, query])

  // Collapsed: a slim rail on desktop, a short bar on mobile — just enough to
  // reopen the panel without eating layout width.
  if (collapsed) {
    return (
      <aside className="flex h-fit items-center gap-2 rounded-[28px] border bg-card p-2 text-card-foreground shadow-sm xl:flex-col">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-xl"
          onClick={onToggleCollapse}
          title="Expand Client Success"
          aria-label="Expand Client Success"
        >
          <PanelLeftOpen className="size-4" />
        </Button>
        <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Users className="size-4" />
        </div>
        <span className="text-sm font-medium xl:hidden">CSM</span>
        <span className="hidden text-xs tracking-wide text-muted-foreground [writing-mode:vertical-rl] xl:block">
          CSM
        </span>
      </aside>
    )
  }

  return (
    <aside className="h-fit overflow-hidden rounded-[28px] border bg-card text-card-foreground shadow-sm">
      <div className="border-b p-4">
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <Users className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold leading-tight">CSM</p>
            <p className="truncate text-xs text-muted-foreground">Who owns which client</p>
          </div>
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 rounded-lg text-muted-foreground"
              onClick={onToggleCollapse}
              title="Collapse Client Success"
              aria-label="Collapse Client Success"
            >
              <PanelLeftClose className="size-4" />
            </Button>
          )}
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search CSM or client..."
            className="rounded-xl bg-background pl-9"
          />
        </div>
      </div>

      <div className="space-y-2 p-3 sm:max-h-[68vh] sm:overflow-y-auto">
        {/* Clearing the selection returns the list to every project. */}
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cn(
            "flex w-full items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm transition-colors",
            selectedCsmId === null
              ? "border-primary/30 bg-primary/10 font-medium"
              : "border-transparent hover:bg-accent/40",
          )}
        >
          All projects
          <span className="ml-auto text-xs text-muted-foreground">{projects.length}</span>
        </button>

        {filtered.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            {entries.length === 0 ? "No employees in the CSM department." : "No matches."}
          </p>
        ) : (
          filtered.map(({ employee, projects: owned, clients }) => {
            const active = selectedCsmId === employee.id
            return (
              <button
                key={employee.id}
                type="button"
                onClick={() => onSelect(employee.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-2xl border p-2.5 text-left transition-colors",
                  active ? "border-primary/30 bg-primary/10" : "border-transparent hover:bg-accent/40",
                )}
              >
                <Avatar className="size-8 shrink-0">
                  <AvatarImage src={employee.avatar} alt={employee.name} />
                  <AvatarFallback className="bg-primary/10 text-tiny font-medium text-primary">
                    {employee.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{employee.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {clients.length} client{clients.length === 1 ? "" : "s"} · {owned.length} project
                    {owned.length === 1 ? "" : "s"}
                  </p>
                </div>
                <ChevronRight className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
              </button>
            )
          })
        )}

        {unassignedCount > 0 && (
          <button
            type="button"
            onClick={() => onSelect(UNASSIGNED_CSM)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-2xl border border-dashed p-2.5 text-left transition-colors",
              selectedCsmId === UNASSIGNED_CSM
                ? "border-warning/50 bg-warning/5"
                : "border-border hover:bg-accent/40",
            )}
          >
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-warning/10 text-warning">
              <ShieldAlert className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">No CSM assigned</p>
              <p className="truncate text-xs text-muted-foreground">
                {unassignedCount} project{unassignedCount === 1 ? "" : "s"}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        )}
      </div>
    </aside>
  )
}
