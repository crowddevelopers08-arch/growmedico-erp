"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, LayoutTemplate, Loader2, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { labelFor } from "@/lib/project-defaults"
import type { ProjectTemplate } from "@/lib/types"

/** Small colour dot used everywhere a stage/status is listed. */
function Dot({ color }: { color: string }) {
  return <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
}

function TemplateCard({
  template,
  onPreview,
  onUse,
}: {
  template: ProjectTemplate
  onPreview: () => void
  onUse: () => void
}) {
  const stageCount = template.stages?.length ?? 0
  const taskCount = template._count?.tasks ?? template.tasks?.length ?? 0

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md">
      {/* Cover. Falls back to a tinted band so cards stay the same height
          whether or not a template has artwork. */}
      <div
        className="flex h-24 items-center justify-center bg-linear-to-br from-primary/15 to-primary/5"
        style={
          template.coverImage
            ? { backgroundImage: `url(${template.coverImage})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      >
        {!template.coverImage && <LayoutTemplate className="size-8 text-primary/50" />}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-full text-xs">{template.category}</Badge>
          {template.tag && (
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/10 text-xs text-primary">
              {template.tag}
            </Badge>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-semibold wrap-break-word">{template.name}</p>
          {template.description && (
            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground wrap-break-word">{template.description}</p>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {stageCount} stage{stageCount === 1 ? "" : "s"} · {taskCount} task{taskCount === 1 ? "" : "s"}
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="sm" className="w-full sm:flex-1" onClick={onPreview}>
            Preview
          </Button>
          <Button size="sm" className="w-full sm:flex-1" onClick={onUse}>
            Use
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * The template gallery. Picking a template hands the whole object back so the
 * wizard can pre-fill its stage and attribute steps from it.
 */
export function ProjectTemplateGallery({
  open,
  onOpenChange,
  onUseTemplate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUseTemplate: (template: ProjectTemplate) => void
}) {
  const [templates, setTemplates] = useState<ProjectTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<string>("all")
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [preview, setPreview] = useState<ProjectTemplate | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    fetch("/api/templates")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setTemplates(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setTemplates([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open])

  // The gallery list omits tasks, so the preview fetches the full record.
  useEffect(() => {
    if (!previewId) {
      setPreview(null)
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    fetch(`/api/templates/${previewId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setPreview(data)
      })
      .catch(() => {
        if (!cancelled) setPreview(null)
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [previewId])

  const categories = useMemo(
    () => ["all", ...Array.from(new Set(templates.map((template) => template.category))).sort()],
    [templates]
  )

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return templates.filter((template) => {
      if (category !== "all" && template.category !== category) return false
      if (!needle) return true
      return (
        template.name.toLowerCase().includes(needle) ||
        (template.description ?? "").toLowerCase().includes(needle) ||
        (template.tag ?? "").toLowerCase().includes(needle)
      )
    })
  }, [templates, query, category])

  const previewStatuses = (preview?.attributes ?? []).filter(
    (attribute) => attribute.scope === "task" && attribute.kind === "status"
  )

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b px-4 py-4 sm:px-6">
            <DialogTitle className="text-xl sm:text-2xl">Start from a template</DialogTitle>
            <DialogDescription>
              Templates bring their own stages, task statuses and starter tasks. You can still edit everything before the
              project is created.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:px-6">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search templates..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((item) => (
                <Button
                  key={item}
                  size="sm"
                  variant={category === item ? "default" : "outline"}
                  className="rounded-full"
                  onClick={() => setCategory(item)}
                >
                  {item === "all" ? "All" : item}
                </Button>
              ))}
            </div>
          </div>

          <ScrollArea className="max-h-[60vh]">
            <div className="p-4 sm:p-6">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Loading templates...
                </div>
              ) : visible.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  No templates match that search.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {visible.map((template) => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onPreview={() => setPreviewId(template.id)}
                      onUse={() => onUseTemplate(template)}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Preview: the same three lists the template will hand to the wizard. */}
      <Dialog open={!!previewId} onOpenChange={(next) => !next && setPreviewId(null)}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b px-4 py-4 sm:px-6">
            <DialogTitle className="wrap-break-word">{preview?.name ?? "Template"}</DialogTitle>
            {preview?.description && (
              <DialogDescription className="wrap-break-word">{preview.description}</DialogDescription>
            )}
          </DialogHeader>

          {previewLoading || !preview ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading...
            </div>
          ) : (
            <Tabs defaultValue="tasks" className="px-4 pb-4 sm:px-6 sm:pb-6">
              <TabsList className="w-full">
                <TabsTrigger value="tasks" className="flex-1">
                  Tasks ({preview.tasks?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="statuses" className="flex-1">
                  Statuses ({previewStatuses.length})
                </TabsTrigger>
                <TabsTrigger value="stages" className="flex-1">
                  Stages ({preview.stages.length})
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="mt-3 max-h-[50vh]">
                <TabsContent value="tasks" className="mt-0 space-y-2">
                  {(preview.tasks ?? []).map((task) => (
                    <div key={task.id} className="flex items-start justify-between gap-3 rounded-xl border p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium wrap-break-word">{task.title}</p>
                        {task.stageName && <p className="text-xs text-muted-foreground">{task.stageName}</p>}
                      </div>
                      <Badge variant="outline" className="shrink-0 rounded-full text-xs capitalize">
                        {task.priority}
                      </Badge>
                    </div>
                  ))}
                  {(preview.tasks ?? []).length === 0 && (
                    <p className="py-8 text-center text-sm text-muted-foreground">No starter tasks.</p>
                  )}
                </TabsContent>

                <TabsContent value="statuses" className="mt-0 space-y-2">
                  {previewStatuses.map((status) => (
                    <div key={status.id} className="flex items-center gap-2.5 rounded-xl border p-3">
                      <Dot color={status.color} />
                      <span className="text-sm wrap-break-word">{labelFor(status.name)}</span>
                      {status.isTerminal && (
                        <Badge variant="outline" className="ml-auto shrink-0 rounded-full text-xs">
                          Done state
                        </Badge>
                      )}
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="stages" className="mt-0 space-y-2">
                  {preview.stages.map((stage, index) => (
                    <div key={stage.id} className="flex items-center gap-2.5 rounded-xl border p-3">
                      <span className="w-5 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
                      <Dot color={stage.color} />
                      <span className="text-sm wrap-break-word">{stage.name}</span>
                    </div>
                  ))}
                </TabsContent>
              </ScrollArea>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" className="w-full sm:flex-1" onClick={() => setPreviewId(null)}>
                  <X className="size-4" /> Close
                </Button>
                <Button
                  className="w-full sm:flex-1"
                  onClick={() => {
                    onUseTemplate(preview)
                    setPreviewId(null)
                  }}
                >
                  <Check className="size-4" /> Use this template
                </Button>
              </div>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

export { Dot as TemplateColorDot }
