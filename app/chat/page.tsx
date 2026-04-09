"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Hash, Plus, Trash2, MessageSquare, Users, Pencil, Check, CheckCheck, X, Play, Pause, FileText, Download, Phone, Video } from "lucide-react"
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
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: IST,
  })
}

function formatDateSeparator(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return "Today"
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: IST })
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
        <span key={i} className="rounded bg-primary/10 px-0.5 text-xs font-medium text-primary">
          @{user?.name ?? fallbackName ?? "Unknown"}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function AudioPlayer({ src, isMine }: { src: string; isMine: boolean }) {
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  return (
    <div className={cn(
      "flex w-[min(70vw,220px)] sm:w-auto items-center gap-2 rounded-xl px-3 py-2 min-w-0 sm:min-w-[180px]",
      isMine ? "bg-primary-foreground/10" : "bg-muted/60"
    )}>
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
        className="size-8 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={() => {
          if (!audioRef.current) return
          if (playing) { audioRef.current.pause(); setPlaying(false) }
          else { audioRef.current.play(); setPlaying(true) }
        }}
      >
        {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
      </Button>
      <div className="flex-1">
        <div className="h-1 overflow-hidden rounded-full bg-border/60">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: duration > 0 ? `${(current / duration) * 100}%` : "0%" }}
          />
        </div>
        <span className="text-[10px] opacity-60 tabular-nums mt-0.5 block">
          {duration > 0
            ? `${Math.floor((duration - current) / 60).toString().padStart(2, "0")}:${Math.floor((duration - current) % 60).toString().padStart(2, "0")}`
            : "0:00"}
        </span>
      </div>
    </div>
  )
}

function AttachmentChip({ att, isMine }: { att: Attachment; isMine: boolean }) {
  if (att.type.startsWith("image/")) {
    return (
      <a href={att.data} download={att.name} className="block">
        <img src={att.data} alt={att.name} className="max-w-[min(65vw,200px)] max-h-48 rounded-lg object-cover" />
      </a>
    )
  }
  return (
    <a
      href={att.data}
      download={att.name}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-opacity hover:opacity-80",
        isMine ? "bg-primary-foreground/10" : "bg-muted/60"
      )}
    >
      <FileText className="size-4 shrink-0" />
      <span className="max-w-[min(44vw,140px)] sm:max-w-[140px] truncate">{att.name}</span>
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

  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteChannel, setDeleteChannel] = useState<Channel | null>(null)
  const [channelName, setChannelName] = useState("")
  const [channelDesc, setChannelDesc] = useState("")
  const [creating, setCreating] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastMessageTime = useRef<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then(setMentionUsers).catch(() => {})
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
    if (!res.ok) {
      if (res.status === 404) {
        await loadChannels()
        setSelectedChannel((prev) => (prev?.id === channelId ? null : prev))
        setMessages([])
        toast.error("This channel is no longer available.")
      }
      return
    }
    const data: Message[] = await res.json()
    if (data.length === 0) return
    if (append) setMessages((prev) => [...prev, ...data])
    else setMessages(data)
    lastMessageTime.current = data[data.length - 1].createdAt
  }, [loadChannels])

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
    if (!res.ok) {
      if (res.status === 404) {
        await loadChannels()
        setSelectedChannel((prev) => (prev?.id === selectedChannel.id ? null : prev))
        setMessages([])
        throw new Error("Channel not found")
      }
      throw new Error(`Send failed (${res.status})`)
    }
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
    const msgDate = new Date(msg.createdAt).toDateString()
    const prevDate = prev ? new Date(prev.createdAt).toDateString() : null
    const showDateSeparator = !prevDate || prevDate !== msgDate
    const isFirst =
      showDateSeparator ||
      !prev ||
      prev.senderId !== msg.senderId ||
      new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() > 5 * 60 * 1000
    return { ...msg, isFirst, showDateSeparator }
  })

  const getTick = (msg: Message) => {
    if (msg.senderId !== currentUserId) return null
    const readByOthers = (msg.readBy ?? []).some((id) => id !== currentUserId)
    if (readByOthers) return <CheckCheck className="size-3.5 text-sky-400" />
    return <Check className="size-3.5 text-primary-foreground/90" />
  }

  return (
    <div className="flex h-[calc(100dvh-7.2rem)] sm:h-[calc(100dvh-8rem)] w-full min-w-0 overflow-hidden rounded-none sm:rounded-xl border-0 sm:border border-border/40 shadow-none sm:shadow-md">
      {/* Sidebar */}
      <div className={cn(
        "w-full sm:w-72 flex flex-col bg-background border-r border-border/30 sm:flex",
        showChannels ? "flex" : "hidden sm:flex"
      )}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between bg-card px-4 py-3 shrink-0 border-b">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-primary" />
            <span className="text-base font-bold text-foreground">Channels</span>
          </div>
          {isAdmin && (
            <Button
              variant="ghost" size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" />
            </Button>
          )}
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto bg-background">
          {channels.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-muted-foreground text-xs text-center px-4 mt-6">
              {isAdmin ? "No channels yet. Create one to start chatting." : "No channels available."}
            </div>
          ) : (
            channels.map((ch) => (
              <div
                key={ch.id}
                onClick={() => selectChannel(ch)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border/20 group",
                  selectedChannel?.id === ch.id
                    ? "bg-primary/10"
                    : "hover:bg-accent/50"
                )}
              >
                {/* Channel avatar */}
                <div className="flex size-12 items-center justify-center rounded-full bg-muted shrink-0">
                  <Hash className="size-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-foreground truncate">{ch.name}</span>
                    {isAdmin && (
                      <Button
                        variant="ghost" size="icon"
                        className="size-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0 ml-1"
                        onClick={(e) => { e.stopPropagation(); setDeleteChannel(ch) }}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {ch.description ?? "Channel"}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* User profile bar */}
        <div className="shrink-0 border-t border-border/30 bg-card p-3">
          <div className="flex items-center gap-2.5">
            <Avatar className="size-8">
              <AvatarImage src={session?.user?.image ?? undefined} />
              <AvatarFallback className="bg-primary/15 text-[10px] text-primary">
                {session?.user?.name?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{session?.user?.name}</p>
              <p className="text-[10px] text-muted-foreground">{isAdmin ? "Admin" : "Employee"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className={cn("flex-1 flex flex-col min-w-0", showChannels ? "hidden sm:flex" : "flex")}>
        {selectedChannel ? (
          <>
            {/* Chat header */}
            <div className="flex h-14 items-center gap-1.5 border-b bg-card px-2 shadow-sm shrink-0 sm:gap-3 sm:px-4">
              <Button
                variant="ghost" size="icon"
                className="size-8 text-muted-foreground hover:text-foreground sm:hidden"
                onClick={() => setShowChannels(true)}
              >
                <Users className="size-4" />
              </Button>
              <div className="flex size-9 items-center justify-center rounded-full bg-muted shrink-0 sm:size-10">
                <Hash className="size-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{selectedChannel.name}</p>
                {selectedChannel.description && (
                  <p className="hidden truncate text-xs text-muted-foreground sm:block">{selectedChannel.description}</p>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground sm:size-8"
                  onClick={() => toast("Voice call option opened")}
                  title="Voice Call"
                >
                  <Phone className="size-3.5 sm:size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground sm:size-8"
                  onClick={() => toast("Video call option opened")}
                  title="Video Call"
                >
                  <Video className="size-3.5 sm:size-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 overflow-x-hidden bg-background">
              <div className="px-2 sm:px-3 py-3">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                    <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                      <Hash className="size-7 text-muted-foreground" />
                    </div>
                    <p className="text-sm">No messages yet. Say hello!</p>
                  </div>
                ) : (
                  groupedMessages.map((msg) => {
                    const isMine = msg.senderId === currentUserId
                    const canEdit = isMine
                    const canDelete = isMine || isAdmin
                    const isEditing = editingMsgId === msg.id
                    const attachments = (msg.attachments as Attachment[] | null) ?? []
                    const readByOthers = isMine && (msg.readBy ?? []).some((id) => id !== currentUserId)

                    return (
                      <div key={msg.id}>
                        {/* Date separator */}
                        {msg.showDateSeparator && (
                          <div className="flex justify-center my-4">
                            <span className="rounded-full bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
                              {formatDateSeparator(msg.createdAt)}
                            </span>
                          </div>
                        )}

                        {/* Message row */}
                        <div className={cn(
                          "flex gap-1.5 sm:gap-2 mb-0.5",
                          isMine ? "flex-row-reverse" : "flex-row",
                          msg.isFirst ? "mt-3" : "mt-0.5"
                        )}>
                          {/* Avatar (others only) */}
                          {!isMine && (
                            msg.isFirst ? (
                              <Avatar className="hidden sm:flex size-8 shrink-0 mt-0.5">
                                <AvatarImage src={msg.senderAvatar ?? undefined} />
                                <AvatarFallback className="bg-primary/15 text-xs text-primary">
                                  {msg.senderName.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <div className="hidden sm:block size-8 shrink-0" />
                            )
                          )}

                          {/* Bubble */}
                          <div className={cn("flex flex-col max-w-[92%] sm:max-w-[70%] lg:max-w-[60%]", isMine ? "items-end" : "items-start")}>
                            <div className="relative group">
                              {/* Hover actions */}
                              {(canEdit || canDelete) && !isEditing && (
                                <div className={cn(
                                  "absolute -top-7 flex items-center gap-0.5 bg-background border border-border rounded-md px-1 py-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10",
                                  isMine ? "right-0" : "left-0"
                                )}>
                                  {canEdit && (
                                    <Button
                                      variant="ghost" size="icon" className="size-5"
                                      onClick={() => { setEditingMsgId(msg.id); setEditContent(msg.content) }}
                                    >
                                      <Pencil className="size-3" />
                                    </Button>
                                  )}
                                  {canDelete && (
                                    <Button
                                      variant="ghost" size="icon" className="size-5 hover:text-destructive"
                                      onClick={() => setDeleteMsgId(msg.id)}
                                    >
                                      <Trash2 className="size-3" />
                                    </Button>
                                  )}
                                </div>
                              )}

                              {isEditing ? (
                                <div className="space-y-1.5 w-[min(16rem,80vw)]">
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
                                    <Button size="sm" className="h-6 gap-1 text-xs" onClick={() => handleEditSave(msg.id)}>
                                      <Check className="size-3" />Save
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => setEditingMsgId(null)}>
                                      <X className="size-3" />Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className={cn(
                                  "px-3 py-2 text-sm break-words shadow-sm space-y-1.5",
                                  isMine
                                    ? cn("bg-primary text-primary-foreground",
                                        msg.isFirst ? "rounded-l-2xl rounded-br-2xl rounded-tr-sm" : "rounded-2xl")
                                    : cn("bg-card text-card-foreground border",
                                        msg.isFirst ? "rounded-r-2xl rounded-bl-2xl rounded-tl-sm" : "rounded-2xl")
                                )}>
                                  {/* Sender name for others */}
                                  {!isMine && msg.isFirst && (
                                    <p className="text-xs font-semibold text-primary">{msg.senderName}</p>
                                  )}
                                  {msg.content && (
                                    <p className="whitespace-pre-wrap leading-relaxed">
                                      {renderContent(msg.content, mentionUsers)}
                                    </p>
                                  )}
                                  {msg.audioContent && <AudioPlayer src={msg.audioContent} isMine={isMine} />}
                                  {attachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                      {attachments.map((att, i) => <AttachmentChip key={i} att={att} isMine={isMine} />)}
                                    </div>
                                  )}
                                  {/* Timestamp inside bubble */}
                                  <div className="flex items-center justify-end gap-1 -mb-0.5">
                                    {msg.editedAt && (
                                      <span className={cn("text-[10px] italic", isMine ? "text-primary-foreground/75" : "text-muted-foreground")}>edited</span>
                                    )}
                                    {isMine && (
                                      <span className="text-[10px] text-primary-foreground/90">
                                        {readByOthers ? "Read" : "Sent"}
                                      </span>
                                    )}
                                    <span className={cn("text-[10px]", isMine ? "text-primary-foreground/90" : "text-muted-foreground")}>
                                      {formatTime(msg.createdAt)}
                                    </span>
                                    {getTick(msg)}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input area */}
            <div className="shrink-0 border-t bg-card px-2 py-2 sm:px-3">
              <ChatInput
                placeholder={`Message #${selectedChannel.name}`}
                users={mentionUsers}
                onSend={async (data) => {
                  try { await handleSend(data) }
                  catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed to send message")
                  }
                }}
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
            <div className="flex size-20 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="size-10 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Select a channel to start chatting</p>
            {isAdmin && (
              <Button
                size="sm"
                onClick={() => setCreateOpen(true)}
              >
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
