"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Hash, Plus, Trash2, MessageSquare, Users, Pencil, Check, X, Play, Pause, FileText, Download } from "lucide-react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { ChatInput, type MentionUser, type SendData, type Attachment } from "@/components/chat-input"
import type { Channel, Message } from "@/lib/types"

const IST = "Asia/Kolkata"

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday =
    d.toLocaleDateString("en-IN", { timeZone: IST }) ===
    now.toLocaleDateString("en-IN", { timeZone: IST })
  if (isToday) return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: IST })
  return (
    d.toLocaleDateString("en-IN", { month: "short", day: "numeric", timeZone: IST }) +
    " " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: IST })
  )
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

function AudioPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  return (
    <div className="flex items-center gap-2 bg-black/5 rounded-lg px-3 py-2 min-w-[160px]">
      <audio
        ref={audioRef}
        src={src}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
        onEnded={() => setPlaying(false)}
      />
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        onClick={() => {
          if (!audioRef.current) return
          if (playing) { audioRef.current.pause(); setPlaying(false) }
          else { audioRef.current.play(); setPlaying(true) }
        }}
      >
        {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
      </Button>
      <div className="flex-1">
        <div className="h-1 bg-black/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-current rounded-full transition-all"
            style={{ width: duration > 0 ? `${(current / duration) * 100}%` : "0%" }}
          />
        </div>
      </div>
      <span className="text-[10px] opacity-60 tabular-nums">
        {duration > 0
          ? `${Math.floor((duration - current) / 60).toString().padStart(2, "0")}:${Math.floor((duration - current) % 60).toString().padStart(2, "0")}`
          : "0:00"}
      </span>
    </div>
  )
}

function AttachmentChip({ att, isMine }: { att: Attachment; isMine: boolean }) {
  if (att.type.startsWith("image/")) {
    return (
      <a href={att.data} download={att.name} className="block">
        <img src={att.data} alt={att.name} className="max-w-[200px] max-h-48 rounded-lg object-cover border" />
      </a>
    )
  }
  return (
    <a
      href={att.data}
      download={att.name}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-opacity hover:opacity-80",
        isMine ? "bg-white/10 border-white/20 text-inherit" : "bg-muted/80 border-border"
      )}
    >
      <FileText className="size-4 shrink-0" />
      <span className="max-w-[140px] truncate">{att.name}</span>
      <Download className="size-3.5 shrink-0 opacity-70" />
    </a>
  )
}

function ChatPageContent() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"

  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [showChannels, setShowChannels] = useState(true)
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([])

  // Edit message state
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null)

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteChannel, setDeleteChannel] = useState<Channel | null>(null)
  const [channelName, setChannelName] = useState("")
  const [channelDesc, setChannelDesc] = useState("")
  const [creating, setCreating] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastMessageTime = useRef<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch mention users once
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then(setMentionUsers)
      .catch(() => {})
  }, [])

  const loadChannels = useCallback(async () => {
    const res = await fetch("/api/channels")
    if (res.ok) setChannels(await res.json())
  }, [])

  const loadMessages = useCallback(async (channelId: string, append = false) => {
    const url =
      append && lastMessageTime.current
        ? `/api/channels/${channelId}/messages?after=${encodeURIComponent(lastMessageTime.current)}`
        : `/api/channels/${channelId}/messages`
    const res = await fetch(url)
    if (!res.ok) return
    const data: Message[] = await res.json()
    if (data.length === 0) return
    if (append) {
      setMessages((prev) => [...prev, ...data])
    } else {
      setMessages(data)
    }
    lastMessageTime.current = data[data.length - 1].createdAt
  }, [])

  useEffect(() => { loadChannels() }, [loadChannels])

  useEffect(() => {
    if (channels.length > 0 && !selectedChannel) setSelectedChannel(channels[0])
  }, [channels, selectedChannel])

  useEffect(() => {
    if (!selectedChannel) return
    lastMessageTime.current = null
    setMessages([])
    loadMessages(selectedChannel.id)
  }, [selectedChannel, loadMessages])

  useEffect(() => {
    if (!selectedChannel) return
    pollRef.current = setInterval(() => loadMessages(selectedChannel.id, true), 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [selectedChannel, loadMessages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async (data: SendData) => {
    if (!selectedChannel) return
    const res = await fetch(`/api/channels/${selectedChannel.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error()
    await loadMessages(selectedChannel.id, true)
  }

  const handleEditSave = async (msgId: string) => {
    if (!editContent.trim() || !selectedChannel) return
    const res = await fetch(`/api/channels/${selectedChannel.id}/messages/${msgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editContent }),
    })
    if (!res.ok) { toast.error("Failed to edit message"); return }
    const updated: Message = await res.json()
    setMessages((prev) => prev.map((m) => (m.id === msgId ? updated : m)))
    setEditingMsgId(null)
  }

  const handleDelete = async (msgId: string) => {
    if (!selectedChannel) return
    const res = await fetch(`/api/channels/${selectedChannel.id}/messages/${msgId}`, { method: "DELETE" })
    if (!res.ok) { toast.error("Failed to delete message"); return }
    setMessages((prev) => prev.filter((m) => m.id !== msgId))
    setDeleteMsgId(null)
    toast.success("Message deleted")
  }

  const handleCreateChannel = async () => {
    if (!channelName.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: channelName.trim(), description: channelDesc.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`#${data.name} created`)
      setCreateOpen(false); setChannelName(""); setChannelDesc("")
      await loadChannels()
      setSelectedChannel(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create channel")
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteChannel = async () => {
    if (!deleteChannel) return
    await fetch(`/api/channels/${deleteChannel.id}`, { method: "DELETE" })
    toast.success("Channel deleted")
    setDeleteChannel(null)
    await loadChannels()
    if (selectedChannel?.id === deleteChannel.id) setSelectedChannel(null)
  }

  const selectChannel = (ch: Channel) => { setSelectedChannel(ch); setShowChannels(false) }
  const currentUserId = session?.user?.id

  const groupedMessages = messages.map((msg, i) => {
    const prev = messages[i - 1]
    const isFirst =
      !prev ||
      prev.senderId !== msg.senderId ||
      new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000
    return { ...msg, isFirst }
  })

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-xl border border-border/50 overflow-hidden bg-background">
      {/* Channel Sidebar */}
      <div className={cn("w-full sm:w-64 border-r border-border/50 flex flex-col bg-sidebar sm:flex", showChannels ? "flex" : "hidden sm:flex")}>
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" />
              <span className="font-semibold text-sm">Channels</span>
            </div>
            {isAdmin && (
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="flex-1 px-2 py-2">
          {channels.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-muted-foreground text-xs text-center px-4">
              {isAdmin ? "No channels yet. Create one to start chatting." : "No channels available."}
            </div>
          ) : (
            channels.map((ch) => (
              <div
                key={ch.id}
                onClick={() => selectChannel(ch)}
                className={cn(
                  "flex items-center justify-between gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors group mb-0.5",
                  selectedChannel?.id === ch.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-foreground"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Hash className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-sm truncate">{ch.name}</span>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost" size="icon"
                    className="size-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={(e) => { e.stopPropagation(); setDeleteChannel(ch) }}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>
            ))
          )}
        </ScrollArea>
        <div className="p-3 border-t border-border/50">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/50">
            <Avatar className="size-6">
              <AvatarImage src={session?.user?.image ?? undefined} />
              <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{session?.user?.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{session?.user?.name}</p>
              <p className="text-[10px] text-muted-foreground">{isAdmin ? "Admin" : "Employee"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className={cn("flex-1 flex flex-col min-w-0", showChannels ? "hidden sm:flex" : "flex")}>
        {selectedChannel ? (
          <>
            <div className="h-14 px-4 border-b border-border/50 flex items-center gap-3 bg-background shrink-0">
              <Button variant="ghost" size="icon" className="sm:hidden size-8" onClick={() => setShowChannels(true)}>
                <Users className="size-4" />
              </Button>
              <Hash className="size-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-sm">{selectedChannel.name}</p>
                {selectedChannel.description && <p className="text-xs text-muted-foreground truncate">{selectedChannel.description}</p>}
              </div>
            </div>

            <ScrollArea className="flex-1 px-4 py-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground py-16">
                  <Hash className="size-10 opacity-20" />
                  <p className="text-sm">No messages yet. Say hello!</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {groupedMessages.map((msg) => {
                    const isMine = msg.senderId === currentUserId
                    const canEdit = isMine
                    const canDelete = isMine || isAdmin
                    const isEditing = editingMsgId === msg.id
                    const attachments = (msg.attachments as Attachment[] | null) ?? []

                    return (
                      <div
                        key={msg.id}
                        className={cn("flex gap-3 px-1 group", isMine ? "flex-row-reverse" : "flex-row", msg.isFirst ? "mt-4" : "mt-0.5")}
                      >
                        {msg.isFirst ? (
                          <Avatar className="size-8 shrink-0 mt-0.5">
                            <AvatarImage src={msg.senderAvatar ?? undefined} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">{msg.senderName.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="size-8 shrink-0" />
                        )}

                        <div className={cn("flex flex-col max-w-[75%]", isMine ? "items-end" : "items-start")}>
                          {msg.isFirst && (
                            <div className={cn("flex items-baseline gap-2 mb-1", isMine ? "flex-row-reverse" : "flex-row")}>
                              <span className="text-xs font-semibold">{isMine ? "You" : msg.senderName}</span>
                              <span className="text-[10px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
                              {msg.editedAt && <span className="text-[10px] text-muted-foreground italic">(edited)</span>}
                            </div>
                          )}

                          <div className="relative">
                            {/* Action buttons on hover */}
                            {(canEdit || canDelete) && !isEditing && (
                              <div className={cn(
                                "absolute -top-6 flex items-center gap-0.5 bg-background border border-border rounded-md px-1 py-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10",
                                isMine ? "right-0" : "left-0"
                              )}>
                                {canEdit && (
                                  <Button variant="ghost" size="icon" className="size-5" onClick={() => { setEditingMsgId(msg.id); setEditContent(msg.content) }}>
                                    <Pencil className="size-3" />
                                  </Button>
                                )}
                                {canDelete && (
                                  <Button variant="ghost" size="icon" className="size-5 hover:text-destructive" onClick={() => setDeleteMsgId(msg.id)}>
                                    <Trash2 className="size-3" />
                                  </Button>
                                )}
                              </div>
                            )}

                            {isEditing ? (
                              <div className="space-y-1.5 w-64">
                                <Textarea
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEditSave(msg.id) }
                                    if (e.key === "Escape") setEditingMsgId(null)
                                  }}
                                  rows={2}
                                  className="text-sm resize-none"
                                  autoFocus
                                />
                                <div className="flex gap-1.5">
                                  <Button size="sm" className="h-6 text-xs gap-1" onClick={() => handleEditSave(msg.id)}>
                                    <Check className="size-3" />Save
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => setEditingMsgId(null)}>
                                    <X className="size-3" />Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className={cn(
                                "px-3 py-2 rounded-2xl text-sm break-words space-y-2",
                                isMine ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted text-foreground rounded-tl-sm"
                              )}>
                                {msg.content && <p className="whitespace-pre-wrap">{renderContent(msg.content, mentionUsers)}</p>}
                                {msg.audioContent && <AudioPlayer src={msg.audioContent} />}
                                {attachments.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {attachments.map((att, i) => <AttachmentChip key={i} att={att} isMine={isMine} />)}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            <div className="p-4 border-t border-border/50 shrink-0">
              <ChatInput
                placeholder={`Message #${selectedChannel.name}`}
                users={mentionUsers}
                onSend={async (data) => {
                  try { await handleSend(data) }
                  catch { toast.error("Failed to send message"); throw new Error() }
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <MessageSquare className="size-12 opacity-20" />
            <p className="text-sm">Select a channel to start chatting</p>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 size-4" />Create Channel
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Create Channel Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Channel</DialogTitle>
            <DialogDescription>Create a new channel for your team.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Channel Name *</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">#</span>
                <Input
                  placeholder="general, announcements..."
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Textarea placeholder="What&apos;s this channel about?" rows={2} value={channelDesc} onChange={(e) => setChannelDesc(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateChannel} disabled={!channelName.trim() || creating}>
              {creating ? "Creating..." : "Create Channel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Channel Dialog */}
      <AlertDialog open={!!deleteChannel} onOpenChange={(o) => !o && setDeleteChannel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete #{deleteChannel?.name}</AlertDialogTitle>
            <AlertDialogDescription>All messages will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteChannel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Message Confirm */}
      <AlertDialog open={!!deleteMsgId} onOpenChange={(o) => !o && setDeleteMsgId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>This message will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMsgId && handleDelete(deleteMsgId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default function ChatPage() {
  return (
    <DashboardLayout>
      <ChatPageContent />
    </DashboardLayout>
  )
}
