"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { MessageSquare, Users, Pencil, Check, CheckCheck, X, Play, Pause, FileText, Download, Phone, Video, Search, ChevronLeft, Plus, UserPlus, Info } from "lucide-react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
      "flex w-[min(70vw,220px)] sm:w-auto items-center gap-2 rounded-xl px-3 py-2 min-w-0 sm:min-w-45",
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
      <span className="max-w-[min(44vw,140px)] sm:max-w-35 truncate">{att.name}</span>
      <Download className="size-3.5 shrink-0 opacity-70" />
    </a>
  )
}

function GroupAvatar({ members }: { members: { userId: string; name: string; avatar?: string | null }[] }) {
  const shown = members.slice(0, 2)
  return (
    <div className="relative size-12 shrink-0">
      {shown.length === 0 ? (
        <div className="size-12 rounded-full bg-primary/15 flex items-center justify-center">
          <Users className="size-5 text-primary" />
        </div>
      ) : shown.length === 1 ? (
        <Avatar className="size-12">
          <AvatarImage src={shown[0].avatar ?? undefined} />
          <AvatarFallback className="bg-primary/15 text-primary">{shown[0].name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
      ) : (
        <>
          <Avatar className="absolute bottom-0 left-0 size-7 border-2 border-background">
            <AvatarImage src={shown[0].avatar ?? undefined} />
            <AvatarFallback className="bg-primary/15 text-[9px] text-primary">{shown[0].name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <Avatar className="absolute top-0 right-0 size-7 border-2 border-background">
            <AvatarImage src={shown[1].avatar ?? undefined} />
            <AvatarFallback className="bg-violet-500/20 text-[9px] text-violet-600">{shown[1].name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </>
      )}
    </div>
  )
}

function ChatPageContent() {
  const { data: session } = useSession()
  const roleLabel = session?.user?.role === "ADMIN" ? "Admin" : session?.user?.role === "MANAGER" ? "Manager" : "Employee"
  const currentUserId = session?.user?.id

  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [showChatList, setShowChatList] = useState(true)
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([])
  const [chatTab, setChatTab] = useState<"all" | "unread">("all")
  const [chatQuery, setChatQuery] = useState("")
  const [openingDirectId, setOpeningDirectId] = useState<string | null>(null)

  // Create Group DM dialog state
  const [createGroupOpen, setCreateGroupOpen] = useState(false)
  const [groupName, setGroupName] = useState("")
  const [groupMemberSearch, setGroupMemberSearch] = useState("")
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [creatingGroup, setCreatingGroup] = useState(false)

  const [membersOpen, setMembersOpen] = useState(false)
  const [addPeopleSearch, setAddPeopleSearch] = useState("")
  const [stagedAddIds, setStagedAddIds] = useState<string[]>([])
  const [addingMembers, setAddingMembers] = useState(false)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [deleteGroupOpen, setDeleteGroupOpen] = useState(false)
  const [deletingGroup, setDeletingGroup] = useState(false)

  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastMessageTime = useRef<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then(setMentionUsers).catch(() => {})
  }, [])

  const loadChannels = useCallback(async () => {
    const res = await fetch("/api/channels")
    if (!res.ok) return
    const data: Channel[] = await res.json()
    setChannels(data.filter((ch) => ch.kind === "direct" || ch.kind === "group_dm"))
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
    if (append) setMessages((prev) => [...prev, ...data])
    else setMessages(data)
    lastMessageTime.current = data[data.length - 1].createdAt
  }, [])

  useEffect(() => {
    void loadChannels()
  }, [loadChannels])

  useEffect(() => {
    if (!selectedChannel) return
    lastMessageTime.current = null
    setMessages([])
    void loadMessages(selectedChannel.id)
  }, [loadMessages, selectedChannel])

  useEffect(() => {
    if (!selectedChannel) return
    pollRef.current = setInterval(() => { void loadMessages(selectedChannel.id, true) }, 3000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [loadMessages, selectedChannel])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const directContacts = useMemo(
    () => mentionUsers.filter((user) => user.userId !== currentUserId),
    [currentUserId, mentionUsers]
  )

  const directChannelByPeerId = useMemo(
    () => new Map(channels.filter((ch) => ch.kind === "direct" && ch.peerUserId).map((ch) => [ch.peerUserId as string, ch])),
    [channels]
  )

  const groupDmChannels = useMemo(
    () => channels.filter((ch) => ch.kind === "group_dm"),
    [channels]
  )

  const filteredGroupDms = useMemo(() => {
    const query = chatQuery.trim().toLowerCase()
    return groupDmChannels.filter((ch) => {
      if (chatTab === "unread" && (ch.unreadCount ?? 0) <= 0) return false
      if (!query) return true
      return (ch.groupTitle ?? ch.name).toLowerCase().includes(query)
    })
  }, [chatQuery, chatTab, groupDmChannels])

  const filteredContacts = useMemo(() => {
    const query = chatQuery.trim().toLowerCase()
    return directContacts.filter((user) => {
      const directChannel = directChannelByPeerId.get(user.userId)
      if (chatTab === "unread" && (directChannel?.unreadCount ?? 0) <= 0) return false
      if (!query) return true
      return user.name.toLowerCase().includes(query)
    })
  }, [chatQuery, chatTab, directChannelByPeerId, directContacts])

  const openDirectChat = async (user: MentionUser) => {
    const existing = directChannelByPeerId.get(user.userId)
    if (existing) {
      setSelectedChannel(existing)
      setShowChatList(false)
      return
    }

    setOpeningDirectId(user.userId)
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "direct", targetUserId: user.userId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to open direct chat")
      await loadChannels()
      setSelectedChannel(data)
      setShowChatList(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open direct chat")
    } finally {
      setOpeningDirectId(null)
    }
  }

  const handleSend = async (data: SendData) => {
    if (!selectedChannel) return
    const res = await fetch(`/api/channels/${selectedChannel.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error("Failed to send message")
    await loadMessages(selectedChannel.id, true)
    await loadChannels()
  }

  const handleEditSave = async (msgId: string) => {
    if (!editContent.trim() || !selectedChannel) return
    const res = await fetch(`/api/channels/${selectedChannel.id}/messages/${msgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editContent }),
    })
    if (!res.ok) {
      toast.error("Failed to edit message")
      return
    }
    const updated: Message = await res.json()
    setMessages((prev) => prev.map((m) => (m.id === msgId ? updated : m)))
    setEditingMsgId(null)
  }

  const handleDelete = async (msgId: string) => {
    if (!selectedChannel) return
    const res = await fetch(`/api/channels/${selectedChannel.id}/messages/${msgId}`, { method: "DELETE" })
    if (!res.ok) {
      toast.error("Failed to delete message")
      return
    }
    setMessages((prev) => prev.filter((m) => m.id !== msgId))
    setDeleteMsgId(null)
    toast.success("Message deleted")
  }

  const handleCreateGroupDm = async () => {
    if (!groupName.trim() || selectedMemberIds.length === 0) return
    setCreatingGroup(true)
    try {
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "group_dm", groupName: groupName.trim(), memberIds: selectedMemberIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to create group")
      toast.success(`Group "${data.name}" created`)
      setCreateGroupOpen(false)
      setGroupName("")
      setSelectedMemberIds([])
      setGroupMemberSearch("")
      await loadChannels()
      setSelectedChannel(data)
      setShowChatList(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create group")
    } finally {
      setCreatingGroup(false)
    }
  }

  const toggleMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const handleAddMembers = async () => {
    if (!selectedChannel || stagedAddIds.length === 0) return
    setAddingMembers(true)
    try {
      const res = await fetch(`/api/channels/${selectedChannel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addMemberIds: stagedAddIds }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to add members")
      setSelectedChannel((prev) => prev ? { ...prev, groupMembers: data.groupMembers } : prev)
      setChannels((prev) => prev.map((ch) => ch.id === selectedChannel.id ? { ...ch, groupMembers: data.groupMembers } : ch))
      setStagedAddIds([])
      setAddPeopleSearch("")
      toast.success(`${stagedAddIds.length} member${stagedAddIds.length > 1 ? "s" : ""} added`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add members")
    } finally {
      setAddingMembers(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!selectedChannel) return
    setRemovingMemberId(userId)
    try {
      const res = await fetch(`/api/channels/${selectedChannel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeMemberIds: [userId] }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to remove member")
      setSelectedChannel((prev) => prev ? { ...prev, groupMembers: data.groupMembers } : prev)
      setChannels((prev) => prev.map((ch) => ch.id === selectedChannel.id ? { ...ch, groupMembers: data.groupMembers } : ch))
      toast.success("Member removed")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member")
    } finally {
      setRemovingMemberId(null)
    }
  }

  const handleDeleteGroup = async () => {
    if (!selectedChannel) return
    setDeletingGroup(true)
    try {
      const res = await fetch(`/api/channels/${selectedChannel.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to delete group")
      toast.success("Group deleted")
      setDeleteGroupOpen(false)
      setMembersOpen(false)
      setSelectedChannel(null)
      setMessages([])
      setChannels((prev) => prev.filter((ch) => ch.id !== selectedChannel.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete group")
    } finally {
      setDeletingGroup(false)
    }
  }

  const filteredMembersForDialog = useMemo(() => {
    const query = groupMemberSearch.trim().toLowerCase()
    return directContacts.filter((u) => !query || u.name.toLowerCase().includes(query))
  }, [directContacts, groupMemberSearch])

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

  const chatHeaderSubtitle = selectedChannel?.kind === "group_dm"
    ? `${selectedChannel.groupMembers?.length ?? 0} members`
    : "Private conversation"

  return (
    <div className="flex h-[calc(100dvh-7.2rem)] sm:h-[calc(100dvh-8rem)] w-full min-w-0 overflow-hidden rounded-none sm:rounded-xl border-0 sm:border border-border/40 shadow-none sm:shadow-md">
      {/* Sidebar */}
      <div className={cn("w-full sm:w-72 flex flex-col bg-background border-r border-border/30 sm:flex", showChatList ? "flex" : "hidden sm:flex")}>
        <div className="bg-card px-4 py-3 shrink-0 border-b">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" />
              <span className="text-base font-bold text-foreground">Private Chats</span>
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={() => { setCreateGroupOpen(true); setGroupName(""); setSelectedMemberIds([]); setGroupMemberSearch("") }}>
              <UserPlus className="size-4" />
              <span className="hidden sm:inline text-xs">New Group</span>
            </Button>
          </div>
        </div>

        <div className="border-b bg-card px-3 py-3">
          <div className="flex items-center rounded-xl bg-[#1b2233] p-1 text-sm">
            {[{ key: "all", label: "All" }, { key: "unread", label: "Unread" }].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setChatTab(tab.key as "all" | "unread")}
                className={cn(
                  "flex-1 rounded-lg px-3 py-2 font-medium text-white transition-colors",
                  chatTab === tab.key ? "bg-[#1f8fff]" : "bg-transparent text-white/90"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={chatQuery} onChange={(e) => setChatQuery(e.target.value)} placeholder="Search chats..." className="pl-9" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-background">
          {/* Group DMs section */}
          {filteredGroupDms.length > 0 && (
            <>
              <div className="px-4 pt-3 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Groups</span>
              </div>
              {filteredGroupDms.map((ch) => {
                const isSelected = selectedChannel?.id === ch.id
                const members = ch.groupMembers ?? []
                const othersInGroup = members.filter((m) => m.userId !== currentUserId)
                return (
                  <div
                    key={ch.id}
                    onClick={() => { setSelectedChannel(ch); setShowChatList(false) }}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border/20",
                      isSelected ? "bg-primary/10" : "hover:bg-accent/50"
                    )}
                  >
                    <GroupAvatar members={othersInGroup} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm text-foreground truncate">{ch.groupTitle ?? ch.name}</span>
                        {(ch.unreadCount ?? 0) > 0 && (
                          <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                            {ch.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {ch.lastMessagePreview ?? `${members.length} members`}
                      </p>
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* Direct contacts section */}
          {(filteredGroupDms.length > 0 || filteredContacts.length > 0) && (
            <div className="px-4 pt-3 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">People</span>
            </div>
          )}
          {filteredContacts.length === 0 && filteredGroupDms.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-muted-foreground text-xs text-center px-4 mt-6">
              {chatTab === "unread" ? "No unread private chats." : "No private chats found."}
            </div>
          ) : (
            filteredContacts.map((user) => {
              const directChannel = directChannelByPeerId.get(user.userId)
              const isSelected = selectedChannel?.kind === "direct" && selectedChannel.peerUserId === user.userId
              return (
                <div
                  key={user.userId}
                  onClick={() => void openDirectChat(user)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border/20",
                    isSelected ? "bg-primary/10" : "hover:bg-accent/50"
                  )}
                >
                  <Avatar className="size-12 shrink-0">
                    <AvatarImage src={user.avatar ?? undefined} />
                    <AvatarFallback className="bg-primary/15 text-primary">
                      {user.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm text-foreground truncate">{user.name}</span>
                      <div className="flex items-center gap-1">
                        {(directChannel?.unreadCount ?? 0) > 0 && (
                          <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                            {directChannel?.unreadCount}
                          </span>
                        )}
                        {openingDirectId === user.userId && <span className="text-[10px] text-muted-foreground">Opening...</span>}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {directChannel?.lastMessagePreview ?? "Private chat"}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>

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
              <p className="text-[10px] text-muted-foreground">{roleLabel}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className={cn("flex-1 flex flex-col min-w-0", showChatList ? "hidden sm:flex" : "flex")}>
        {selectedChannel ? (
          <>
            <div className="flex h-14 items-center gap-1.5 border-b bg-card px-2 shadow-sm shrink-0 sm:gap-3 sm:px-4">
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground sm:hidden" onClick={() => setShowChatList(true)}>
                <ChevronLeft className="size-4" />
              </Button>
              {selectedChannel.kind === "group_dm" ? (
                <GroupAvatar members={(selectedChannel.groupMembers ?? []).filter((m) => m.userId !== currentUserId)} />
              ) : (
                <Avatar className="size-9 shrink-0 sm:size-10">
                  <AvatarImage src={selectedChannel.peerAvatar ?? undefined} />
                  <AvatarFallback className="bg-primary/15 text-primary">
                    {(selectedChannel.peerName ?? selectedChannel.name).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{selectedChannel.groupTitle ?? selectedChannel.name}</p>
                <p className="hidden truncate text-xs text-muted-foreground sm:block">{chatHeaderSubtitle}</p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {selectedChannel.kind === "group_dm" && (
                  <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground sm:size-8" onClick={() => setMembersOpen(true)} title="View Members">
                    <Info className="size-3.5 sm:size-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground sm:size-8" onClick={() => toast("Voice call option opened")} title="Voice Call">
                  <Phone className="size-3.5 sm:size-4" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground sm:size-8" onClick={() => toast("Video call option opened")} title="Video Call">
                  <Video className="size-3.5 sm:size-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 overflow-x-hidden bg-background">
              <div className="px-2 sm:px-3 py-3">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
                    <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                      <Users className="size-7 text-muted-foreground" />
                    </div>
                    <p className="text-sm">No messages yet. Say hello!</p>
                  </div>
                ) : (
                  groupedMessages.map((msg) => {
                    const isMine = msg.senderId === currentUserId
                    const canEdit = isMine
                    const canDelete = isMine || session?.user?.role === "ADMIN"
                    const isEditing = editingMsgId === msg.id
                    const attachments = (msg.attachments as Attachment[] | null) ?? []
                    const readByOthers = isMine && (msg.readBy ?? []).some((id) => id !== currentUserId)

                    return (
                      <div key={msg.id}>
                        {msg.showDateSeparator && (
                          <div className="flex justify-center my-4">
                            <span className="rounded-full bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
                              {formatDateSeparator(msg.createdAt)}
                            </span>
                          </div>
                        )}

                        <div className={cn("flex gap-1.5 sm:gap-2 mb-0.5", isMine ? "flex-row-reverse" : "flex-row", msg.isFirst ? "mt-3" : "mt-0.5")}>
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

                          <div className={cn("flex flex-col max-w-[92%] sm:max-w-[70%] lg:max-w-[60%]", isMine ? "items-end" : "items-start")}>
                            <div className="relative group">
                              {(canEdit || canDelete) && !isEditing && (
                                <div className={cn(
                                  "absolute -top-7 flex items-center gap-0.5 bg-background border border-border rounded-md px-1 py-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10",
                                  isMine ? "right-0" : "left-0"
                                )}>
                                  {canEdit && (
                                    <Button variant="ghost" size="icon" className="size-5" onClick={() => { setEditingMsgId(msg.id); setEditContent(msg.content) }}>
                                      <Pencil className="size-3" />
                                    </Button>
                                  )}
                                  {canDelete && (
                                    <Button variant="ghost" size="icon" className="size-5 hover:text-destructive" onClick={() => setDeleteMsgId(msg.id)}>
                                      <X className="size-3" />
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
                                      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleEditSave(msg.id) }
                                      if (e.key === "Escape") setEditingMsgId(null)
                                    }}
                                    rows={2}
                                    className="text-sm resize-none"
                                    autoFocus
                                  />
                                  <div className="flex gap-1.5">
                                    <Button size="sm" className="h-6 gap-1 text-xs" onClick={() => void handleEditSave(msg.id)}><Check className="size-3" />Save</Button>
                                    <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => setEditingMsgId(null)}><X className="size-3" />Cancel</Button>
                                  </div>
                                </div>
                              ) : (
                                <div className={cn(
                                  "px-3 py-2 text-sm wrap-break-word shadow-sm space-y-1.5",
                                  isMine
                                    ? cn("bg-primary text-primary-foreground", msg.isFirst ? "rounded-l-2xl rounded-br-2xl rounded-tr-sm" : "rounded-2xl")
                                    : cn("bg-card text-card-foreground border", msg.isFirst ? "rounded-r-2xl rounded-bl-2xl rounded-tl-sm" : "rounded-2xl")
                                )}>
                                  {!isMine && msg.isFirst && <p className="text-xs font-semibold text-primary">{msg.senderName}</p>}
                                  {msg.content && <p className="whitespace-pre-wrap leading-relaxed">{renderContent(msg.content, mentionUsers)}</p>}
                                  {msg.audioContent && <AudioPlayer src={msg.audioContent} isMine={isMine} />}
                                  {attachments.length > 0 && <div className="flex flex-wrap gap-2">{attachments.map((att, i) => <AttachmentChip key={i} att={att} isMine={isMine} />)}</div>}
                                  <div className="flex items-center justify-end gap-1 -mb-0.5">
                                    {msg.editedAt && <span className={cn("text-[10px] italic", isMine ? "text-primary-foreground/75" : "text-muted-foreground")}>edited</span>}
                                    {isMine && <span className="text-[10px] text-primary-foreground/90">{readByOthers ? "Read" : "Sent"}</span>}
                                    <span className={cn("text-[10px]", isMine ? "text-primary-foreground/90" : "text-muted-foreground")}>{formatTime(msg.createdAt)}</span>
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

            <div className="shrink-0 border-t bg-card px-2 py-2 sm:px-3">
              <ChatInput
                placeholder={`Message ${selectedChannel.groupTitle ?? selectedChannel.name}`}
                users={mentionUsers}
                onSend={async (data) => {
                  try {
                    await handleSend(data)
                  } catch (err) {
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
            <p className="text-sm font-medium">Select a chat to start messaging</p>
          </div>
        )}
      </div>

      {/* Delete message dialog */}
      <AlertDialog open={!!deleteMsgId} onOpenChange={(o) => !o && setDeleteMsgId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>This message will be permanently deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMsgId && void handleDelete(deleteMsgId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Group Members dialog */}
      {selectedChannel?.kind === "group_dm" && (() => {
        const members = selectedChannel.groupMembers ?? []
        const isManager = selectedChannel.createdById === currentUserId || session?.user?.role === "ADMIN"
        const currentMemberIds = new Set(members.map((m) => m.userId))
        const addablePeople = directContacts.filter((u) => !currentMemberIds.has(u.userId))
        const filteredAddable = addPeopleSearch.trim()
          ? addablePeople.filter((u) => u.name.toLowerCase().includes(addPeopleSearch.toLowerCase()))
          : addablePeople

        return (
          <>
            <Dialog open={membersOpen} onOpenChange={(o) => { setMembersOpen(o); if (!o) { setStagedAddIds([]); setAddPeopleSearch("") } }}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    {selectedChannel.groupTitle ?? selectedChannel.name}
                  </DialogTitle>
                  <DialogDescription>{members.length} member{members.length !== 1 ? "s" : ""}</DialogDescription>
                </DialogHeader>

                {/* Current members */}
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Members</p>
                  <ScrollArea className="max-h-44 rounded-md border">
                    <div className="p-1">
                      {members.map((member) => {
                        const isMe = member.userId === currentUserId
                        const isCreator = member.userId === selectedChannel.createdById
                        const canRemove = isManager && !isCreator
                        return (
                          <div key={member.userId} className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
                            <Avatar className="size-8 shrink-0">
                              <AvatarImage src={member.avatar ?? undefined} />
                              <AvatarFallback className="bg-primary/15 text-xs text-primary">
                                {member.name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{member.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {isCreator ? "Creator" : isMe ? "You" : ""}
                              </p>
                            </div>
                            {canRemove && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
                                disabled={removingMemberId === member.userId}
                                onClick={() => void handleRemoveMember(member.userId)}
                                title="Remove member"
                              >
                                <X className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </div>

                {/* Add people section */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Add People</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={addPeopleSearch}
                      onChange={(e) => setAddPeopleSearch(e.target.value)}
                      placeholder="Search people to add..."
                      className="pl-8 h-8 text-sm"
                    />
                  </div>

                  {stagedAddIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {stagedAddIds.map((id) => {
                        const u = directContacts.find((c) => c.userId === id)
                        if (!u) return null
                        return (
                          <span key={id} className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                            {u.name}
                            <button type="button" onClick={() => setStagedAddIds((prev) => prev.filter((x) => x !== id))} className="ml-0.5 hover:text-destructive">
                              <X className="size-3" />
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}

                  <ScrollArea className="h-32 rounded-md border">
                    <div className="p-1">
                      {filteredAddable.length === 0 ? (
                        <p className="text-center text-xs text-muted-foreground py-5">
                          {addablePeople.length === 0 ? "Everyone is already in this group." : "No people found."}
                        </p>
                      ) : (
                        filteredAddable.map((user) => {
                          const isStaged = stagedAddIds.includes(user.userId)
                          return (
                            <button
                              key={user.userId}
                              type="button"
                              onClick={() => setStagedAddIds((prev) => isStaged ? prev.filter((x) => x !== user.userId) : [...prev, user.userId])}
                              className={cn("flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors", isStaged ? "bg-primary/10" : "hover:bg-accent")}
                            >
                              <Avatar className="size-7 shrink-0">
                                <AvatarImage src={user.avatar ?? undefined} />
                                <AvatarFallback className="bg-primary/15 text-[9px] text-primary">{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <span className="flex-1 text-sm truncate">{user.name}</span>
                              {isStaged && <Check className="size-3.5 text-primary shrink-0" />}
                            </button>
                          )
                        })
                      )}
                    </div>
                  </ScrollArea>

                  {stagedAddIds.length > 0 && (
                    <Button size="sm" className="w-full gap-1.5" onClick={() => void handleAddMembers()} disabled={addingMembers}>
                      <UserPlus className="size-3.5" />
                      Add {stagedAddIds.length} Person{stagedAddIds.length > 1 ? "s" : ""}
                    </Button>
                  )}
                </div>

                {/* Footer */}
                {isManager && (
                  <div className="pt-1 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                      onClick={() => setDeleteGroupOpen(true)}
                    >
                      <X className="size-3.5" />
                      Delete Group
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Delete group confirm */}
            <AlertDialog open={deleteGroupOpen} onOpenChange={setDeleteGroupOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete group?</AlertDialogTitle>
                  <AlertDialogDescription>
                    &ldquo;{selectedChannel.groupTitle ?? selectedChannel.name}&rdquo; and all its messages will be permanently deleted. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deletingGroup}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => void handleDeleteGroup()}
                    disabled={deletingGroup}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Group
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )
      })()}

      {/* Create Group DM dialog */}
      <Dialog open={createGroupOpen} onOpenChange={(o) => { setCreateGroupOpen(o); if (!o) { setGroupName(""); setSelectedMemberIds([]); setGroupMemberSearch("") } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-4 text-primary" />
              Create Group Chat
            </DialogTitle>
            <DialogDescription>Name your group and add people to it.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>Group Name</Label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Design Team, Project Alpha..."
                maxLength={60}
              />
            </div>

            <div className="space-y-2">
              <Label>Add People</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={groupMemberSearch}
                  onChange={(e) => setGroupMemberSearch(e.target.value)}
                  placeholder="Search people..."
                  className="pl-8 h-8 text-sm"
                />
              </div>

              {selectedMemberIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedMemberIds.map((id) => {
                    const user = directContacts.find((u) => u.userId === id)
                    if (!user) return null
                    return (
                      <span
                        key={id}
                        className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                      >
                        {user.name}
                        <button type="button" onClick={() => toggleMember(id)} className="ml-0.5 hover:text-destructive">
                          <X className="size-3" />
                        </button>
                      </span>
                    )
                  })}
                </div>
              )}

              <ScrollArea className="h-44 rounded-md border">
                <div className="p-1">
                  {filteredMembersForDialog.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-6">No people found.</p>
                  ) : (
                    filteredMembersForDialog.map((user) => {
                      const isSelected = selectedMemberIds.includes(user.userId)
                      return (
                        <button
                          key={user.userId}
                          type="button"
                          onClick={() => toggleMember(user.userId)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
                            isSelected ? "bg-primary/10" : "hover:bg-accent"
                          )}
                        >
                          <Avatar className="size-7 shrink-0">
                            <AvatarImage src={user.avatar ?? undefined} />
                            <AvatarFallback className="bg-primary/15 text-[9px] text-primary">
                              {user.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="flex-1 text-sm truncate">{user.name}</span>
                          {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                        </button>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateGroupOpen(false)} disabled={creatingGroup}>Cancel</Button>
            <Button
              onClick={handleCreateGroupDm}
              disabled={!groupName.trim() || selectedMemberIds.length === 0 || creatingGroup}
            >
              <Plus className="size-3.5 mr-1" />
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
