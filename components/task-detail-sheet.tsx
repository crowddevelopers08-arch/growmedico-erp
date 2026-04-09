"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  CalendarIcon, Clock, CircleDot, CheckCircle2,
  AlertCircle, MessageSquare, User, Pencil, Trash2, Check, X,
  Play, Pause, FileText, Download,
} from "lucide-react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { ChatInput, type MentionUser, type SendData, type Attachment } from "@/components/chat-input"
import type { Task, TaskStatus, TaskPriority, TaskComment } from "@/lib/types"

interface TaskDetailSheetProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  employeeName?: string
  employeeAvatar?: string
  isAdmin: boolean
  onStatusChange: (task: Task, status: TaskStatus) => Promise<void>
  onEditTask?: (task: Task) => void
}

function PersonCard({
  label,
  name,
  avatar,
}: {
  label: string
  name?: string | null
  avatar?: string | null
}) {
  const fallback = (name ?? "NA").slice(0, 2).toUpperCase()

  return (
    <div className="min-w-0 rounded-xl border border-border/50 bg-muted/30 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <Avatar className="size-12">
          <AvatarImage src={avatar ?? undefined} />
          <AvatarFallback>{fallback}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{name ?? "Unknown"}</p>
        </div>
      </div>
    </div>
  )
}

const priorityConfig: Record<TaskPriority, { label: string; class: string }> = {
  low:    { label: "Low",    class: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
  medium: { label: "Medium", class: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  high:   { label: "High",   class: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
  urgent: { label: "Urgent", class: "bg-red-500/10 text-red-600 border-red-500/20" },
}

const statusConfig: Record<TaskStatus, { label: string; icon: React.ElementType; class: string }> = {
  pending:     { label: "Pending",     icon: Clock,        class: "bg-warning/10 text-warning border-warning/20" },
  in_progress: { label: "In Progress", icon: CircleDot,    class: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  completed:   { label: "Completed",   icon: CheckCircle2, class: "bg-success/10 text-success border-success/20" },
  cancelled:   { label: "Cancelled",   icon: AlertCircle,  class: "bg-muted text-muted-foreground border-border" },
}

const statuses: TaskStatus[] = ["pending", "in_progress", "completed", "cancelled"]

const IST = "Asia/Kolkata"

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", timeZone: IST })
}

function renderContent(content: string, users: MentionUser[]) {
  if (!content) return null
  const parts = content.split(/(<@[^>]+>)/g)
  return parts.map((part, i) => {
    const match = part.match(/^<@([^|>]+)(?:\|([^>]+))?>$/)
    if (match) {
      const user = users.find((u) => u.userId === match[1])
      const fallbackName = match[2]
      return (
        <span key={i} className="text-primary font-medium bg-primary/10 px-0.5 rounded text-xs">
          @{user?.name ?? fallbackName ?? "Unknown"}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function CommentAudioPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  return (
    <div className="flex items-center gap-2 bg-black/5 rounded-lg px-3 py-2 min-w-37.5">
      <audio ref={audioRef} src={src}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
        onEnded={() => setPlaying(false)}
      />
      <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={() => {
        if (!audioRef.current) return
        if (playing) { audioRef.current.pause(); setPlaying(false) }
        else { audioRef.current.play(); setPlaying(true) }
      }}>
        {playing ? <Pause className="size-3" /> : <Play className="size-3" />}
      </Button>
      <div className="flex-1">
        <div className="h-1 bg-black/20 rounded-full overflow-hidden">
          <div className="h-full bg-current rounded-full transition-all" style={{ width: duration > 0 ? `${(current / duration) * 100}%` : "0%" }} />
        </div>
      </div>
      <span className="text-[10px] opacity-60 tabular-nums">
        {duration > 0
          ? `${Math.floor((duration - current) / 60)}:${Math.floor((duration - current) % 60).toString().padStart(2, "0")}`
          : "0:00"}
      </span>
    </div>
  )
}

export function TaskDetailSheet({
  task, open, onOpenChange, employeeName, employeeAvatar, isAdmin, onStatusChange, onEditTask,
}: TaskDetailSheetProps) {
  const { data: session } = useSession()
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([])
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  const loadComments = useCallback(async () => {
    if (!task) return
    setLoadingComments(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`)
      if (res.ok) setComments(await res.json())
    } finally {
      setLoadingComments(false)
    }
  }, [task])

  useEffect(() => {
    if (open && task) { setComments([]); loadComments() }
  }, [open, task, loadComments])

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then(setMentionUsers).catch(() => {})
  }, [])

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [comments])

  const handleSend = async (data: SendData) => {
    if (!task) return
    const res = await fetch(`/api/tasks/${task.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error((await res.json()).error)
    await loadComments()
  }

  const handleEditSave = async (commentId: string) => {
    if (!editContent.trim() || !task) return
    const res = await fetch(`/api/tasks/${task.id}/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editContent }),
    })
    if (!res.ok) { toast.error("Failed to edit comment"); return }
    const updated: TaskComment = await res.json()
    setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)))
    setEditingCommentId(null)
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!task) return
    const res = await fetch(`/api/tasks/${task.id}/comments/${commentId}`, { method: "DELETE" })
    if (!res.ok) { toast.error("Failed to delete comment"); return }
    setComments((prev) => prev.filter((c) => c.id !== commentId))
    setDeleteCommentId(null)
    toast.success("Comment deleted")
  }

  const handleStatusChange = async (status: TaskStatus) => {
    if (!task) return
    setStatusUpdating(true)
    try { await onStatusChange(task, status) }
    finally { setStatusUpdating(false) }
  }

  if (!task) return null

  const StatusIcon = statusConfig[task.status].icon
  const isOverdue = task.dueDate && task.status !== "completed" && task.status !== "cancelled" && new Date(task.dueDate) < new Date()
  const currentUserId = session?.user?.id
  const projectName = task.clientName && task.projectName
    ? `${task.clientName} - ${task.projectName}`
    : task.projectName ?? null
  const assigner = mentionUsers.find((user) =>
    user.userId === task.assignedById || user.employeeId === task.assignedById
  )
  const assignerName = task.assignedByName ?? assigner?.name
  const assignerAvatar = task.assignedByAvatar ?? assigner?.avatar

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col p-0 gap-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50">
            <div className="flex items-start gap-3">
              <div className={`mt-1 size-2.5 rounded-full shrink-0 ${
                task.priority === "urgent" ? "bg-red-500" :
                task.priority === "high" ? "bg-orange-500" :
                task.priority === "medium" ? "bg-blue-500" : "bg-slate-400"
              }`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <SheetTitle className="text-base font-semibold leading-snug">{task.title}</SheetTitle>
                  {isAdmin && onEditTask && (
                    <Button variant="ghost" size="icon" className="size-7 shrink-0 -mt-0.5" onClick={() => onEditTask(task)} title="Edit task">
                      <Pencil className="size-3.5" />
                    </Button>
                  )}
                </div>
                {task.description && <SheetDescription className="mt-1 text-sm">{task.description}</SheetDescription>}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              {projectName && (
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                  Project: {projectName}
                </Badge>
              )}
              <Badge variant="outline" className={`text-xs gap-1 ${priorityConfig[task.priority].class}`}>
                {priorityConfig[task.priority].label}
              </Badge>
              <Badge variant="outline" className={`text-xs gap-1 ${statusConfig[task.status].class}`}>
                <StatusIcon className="size-3" />{statusConfig[task.status].label}
              </Badge>
              {isOverdue && <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/20">Overdue</Badge>}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <PersonCard label="Created By" name={assignerName} avatar={assignerAvatar} />
              <PersonCard label="Assigner" name={assignerName} avatar={assignerAvatar} />
              <PersonCard label="Assignee" name={employeeName ?? "Unassigned"} avatar={employeeAvatar} />
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
              {task.dueDate && (
                <div className={`flex items-center gap-1.5 ${isOverdue ? "text-red-500" : ""}`}>
                  <CalendarIcon className="size-3.5" />
                  <span>Due {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-muted-foreground">Status:</span>
              <Select value={task.status} onValueChange={(v) => handleStatusChange(v as TaskStatus)} disabled={statusUpdating}>
                <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => <SelectItem key={s} value={s} className="text-xs">{statusConfig[s].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </SheetHeader>

          <div className="flex items-center gap-2 px-6 py-3 border-b border-border/50 bg-muted/30">
            <MessageSquare className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              Comments {comments.length > 0 && <span className="text-muted-foreground">({comments.length})</span>}
            </span>
          </div>

          <ScrollArea className="flex-1 px-6 py-4">
            {loadingComments ? (
              <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 gap-2 text-muted-foreground">
                <MessageSquare className="size-7 opacity-30" />
                <p className="text-xs">No comments yet. Start the discussion!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((comment, i) => {
                  const isMine = comment.senderId === currentUserId
                  const canEdit = isMine
                  const canDelete = isMine || isAdmin
                  const prev = comments[i - 1]
                  const isGrouped = prev && prev.senderId === comment.senderId &&
                    new Date(comment.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000
                  const isEditing = editingCommentId === comment.id
                  const attachments = (comment.attachments as Attachment[] | null) ?? []

                  return (
                    <div key={comment.id} className={`flex gap-3 group ${isGrouped ? "mt-1" : "mt-4"}`}>
                      {!isGrouped ? (
                        <Avatar className="size-7 shrink-0 mt-0.5">
                          <AvatarImage src={comment.senderAvatar ?? undefined} />
                          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{comment.senderName.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="size-7 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        {!isGrouped && (
                          <div className="flex items-baseline justify-between mb-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-semibold">{isMine ? "You" : comment.senderName}</span>
                              <span className="text-[10px] text-muted-foreground">{formatTime(comment.createdAt)}</span>
                              {comment.editedAt && <span className="text-[10px] text-muted-foreground italic">(edited)</span>}
                            </div>
                            {(canEdit || canDelete) && (
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                {canEdit && (
                                  <Button variant="ghost" size="icon" className="size-5" onClick={() => { setEditingCommentId(comment.id); setEditContent(comment.content) }}>
                                    <Pencil className="size-3" />
                                  </Button>
                                )}
                                {canDelete && (
                                  <Button variant="ghost" size="icon" className="size-5 hover:text-destructive" onClick={() => setDeleteCommentId(comment.id)}>
                                    <Trash2 className="size-3" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {isEditing ? (
                          <div className="space-y-1.5">
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSave(comment.id) }
                                if (e.key === "Escape") setEditingCommentId(null)
                              }}
                              rows={2}
                              className="text-sm resize-none"
                              autoFocus
                            />
                            <div className="flex gap-1.5">
                              <Button size="sm" className="h-6 text-xs gap-1" onClick={() => handleEditSave(comment.id)}>
                                <Check className="size-3" />Save
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => setEditingCommentId(null)}>
                                <X className="size-3" />Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-foreground bg-muted/50 rounded-lg px-3 py-2 wrap-break-word space-y-2">
                            {comment.content && <p className="whitespace-pre-wrap">{renderContent(comment.content, mentionUsers)}</p>}
                            {comment.audioContent && <CommentAudioPlayer src={comment.audioContent} />}
                            {attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {attachments.map((att, j) =>
                                  att.type.startsWith("image/") ? (
                                    <a key={j} href={att.data} download={att.name}>
                                      <img src={att.data} alt={att.name} className="max-w-40 max-h-40 rounded-lg object-cover border" />
                                    </a>
                                  ) : (
                                    <a key={j} href={att.data} download={att.name} className="flex items-center gap-1.5 px-2 py-1.5 bg-background rounded border text-xs hover:opacity-80">
                                      <FileText className="size-3.5 shrink-0" />
                                      <span className="max-w-30 truncate">{att.name}</span>
                                      <Download className="size-3 shrink-0 opacity-60" />
                                    </a>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div ref={commentsEndRef} />
              </div>
            )}
          </ScrollArea>

          <Separator />

          <div className="px-6 py-4 shrink-0">
            <div className="flex items-start gap-3">
              <Avatar className="size-7 shrink-0 mt-1">
                <AvatarImage src={session?.user?.image ?? undefined} />
                <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{session?.user?.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <ChatInput
                  placeholder="Add a comment..."
                  users={mentionUsers}
                  rows={2}
                  onSend={async (data) => {
                    try { await handleSend(data) }
                    catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to send")
                      throw err
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteCommentId} onOpenChange={(o) => !o && setDeleteCommentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment?</AlertDialogTitle>
            <AlertDialogDescription>This comment will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteCommentId && handleDeleteComment(deleteCommentId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
