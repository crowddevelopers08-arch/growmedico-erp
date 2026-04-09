"use client"

import { useState, useRef, useCallback } from "react"
import { Send, Mic, Square, Paperclip, X, Play, Pause, FileText, Smile } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export interface Attachment {
  name: string
  type: string
  data: string
  size: number
}

export interface MentionUser {
  userId: string
  employeeId?: string
  name: string
  avatar?: string | null
}

export interface SendData {
  content: string
  audioContent?: string | null
  attachments?: Attachment[]
  mentions?: string[]
}

interface ChatInputProps {
  placeholder?: string
  users: MentionUser[]
  disabled?: boolean
  onSend: (data: SendData) => Promise<void>
  rows?: number
}

export function ChatInput({ placeholder = "Type a message...", users, disabled, onSend, rows = 1 }: ChatInputProps) {
  const [content, setContent] = useState("")
  const [mentionIds, setMentionIds] = useState<string[]>([])
  const [mentionState, setMentionState] = useState<{ start: number; query: string } | null>(null)
  const [pendingAudio, setPendingAudio] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [sending, setSending] = useState(false)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const quickEmojis = [
    "\u{1F600}",
    "\u{1F601}",
    "\u{1F602}",
    "\u{1F60A}",
    "\u{1F60D}",
    "\u{1F60E}",
    "\u{1F91D}",
    "\u{1F44D}",
    "\u{1F64F}",
    "\u{1F389}",
    "\u{1F525}",
    "\u{2764}\u{FE0F}",
    "\u{2705}",
    "\u{1F4A1}",
  ]

  const filteredUsers = mentionState
    ? users.filter((u) => u.name.toLowerCase().includes(mentionState.query.toLowerCase())).slice(0, 8)
    : []

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setContent(val)
    const cursor = e.target.selectionStart
    const textBeforeCursor = val.slice(0, cursor)
    const match = textBeforeCursor.match(/@(\w*)$/)
    if (match) {
      setMentionState({ start: cursor - match[0].length, query: match[1] })
    } else {
      setMentionState(null)
    }
  }

  const selectMention = useCallback(
    (user: MentionUser) => {
      if (!mentionState) return
      const before = content.slice(0, mentionState.start)
      const after = content.slice(mentionState.start + 1 + mentionState.query.length)
      setContent(`${before}@[${user.name}] ${after}`)
      setMentionIds((prev) => (prev.includes(user.userId) ? prev : [...prev, user.userId]))
      setMentionState(null)
      setTimeout(() => textareaRef.current?.focus(), 0)
    },
    [mentionState, content]
  )

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        const reader = new FileReader()
        reader.onload = () => setPendingAudio(reader.result as string)
        reader.readAsDataURL(blob)
        stream.getTracks().forEach((t) => t.stop())
      }
      recorder.start()
      setIsRecording(true)
      setRecordingTime(0)
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000)
    } catch {
      toast.error("Cannot access microphone")
    }
  }

  const stopRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    files.forEach((file) => {
      if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} exceeds 5MB`); return }
      const reader = new FileReader()
      reader.onload = () =>
        setAttachments((prev) => [...prev, { name: file.name, type: file.type, data: reader.result as string, size: file.size }])
      reader.readAsDataURL(file)
    })
    e.target.value = ""
  }

  const handleSend = async () => {
    if (sending || disabled) return
    if (!content.trim() && !pendingAudio && attachments.length === 0) return
    setSending(true)
    try {
      await onSend({
        content: content.trim(),
        audioContent: pendingAudio,
        attachments: attachments.length > 0 ? attachments : undefined,
        mentions: mentionIds.length > 0 ? mentionIds : undefined,
      })
      setContent(""); setPendingAudio(null); setAttachments([]); setMentionIds([]); setMentionState(null)
    } finally {
      setSending(false)
    }
  }

  const insertEmoji = (emoji: string) => {
    const ta = textareaRef.current
    if (!ta) { setContent((prev) => `${prev}${emoji}`); return }
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const next = `${content.slice(0, start)}${emoji}${content.slice(end)}`
    setContent(next)
    setShowEmoji(false)
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + emoji.length
      ta.setSelectionRange(pos, pos)
    })
  }

  const fmtTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`
  const canSend = (content.trim() || pendingAudio || attachments.length > 0) && !sending && !disabled && !isRecording

  return (
    <div className="space-y-2">
      {/* Pending voice message */}
      {pendingAudio && (
        <div className="flex items-center gap-2 rounded-2xl bg-card px-3 py-2 shadow-sm border">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary shrink-0">
            <Mic className="size-4 text-primary-foreground" />
          </div>
          <audio ref={audioRef} src={pendingAudio} onEnded={() => setAudioPlaying(false)} className="hidden" />
          <Button variant="ghost" size="icon" className="size-7 rounded-full" onClick={() => {
            if (!audioRef.current) return
            if (audioPlaying) { audioRef.current.pause(); setAudioPlaying(false) }
            else { audioRef.current.play(); setAudioPlaying(true) }
          }}>
            {audioPlaying ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          </Button>
          <span className="text-xs text-muted-foreground flex-1">Voice message ready</span>
          <Button variant="ghost" size="icon" className="size-7 rounded-full hover:text-destructive" onClick={() => setPendingAudio(null)}>
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {attachments.map((att, i) => (
            <div key={i} className="relative group">
              {att.type.startsWith("image/") ? (
                <img src={att.data} alt={att.name} className="size-16 object-cover rounded-xl border border-border/30" />
              ) : (
                <div className="flex max-w-36 items-center gap-1.5 rounded-xl border bg-card px-2 py-1.5 text-xs shadow-sm">
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{att.name}</span>
                </div>
              )}
              <button
                onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 size-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="size-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Mention dropdown */}
      {mentionState && filteredUsers.length > 0 && (
        <div className="max-h-48 overflow-y-auto overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
          {filteredUsers.map((user) => (
            <button
              key={user.userId}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/50"
              onMouseDown={(e) => { e.preventDefault(); selectMention(user) }}
            >
              <Avatar className="size-7">
                <AvatarImage src={user.avatar ?? undefined} />
                <AvatarFallback className="bg-primary/15 text-[9px] text-primary">{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span>{user.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main input row */}
      <div className="flex items-end gap-1.5 sm:gap-2">
        {/* Pill input container */}
        <div className="flex min-h-11 flex-1 items-end gap-0.5 rounded-3xl border bg-card px-1.5 py-1.5 shadow-sm sm:gap-1 sm:px-2">
          {/* Emoji button */}
          <Button
            variant="ghost" size="icon"
            className="mb-0.5 size-8 shrink-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
            disabled={disabled}
            title="Emoji"
            onClick={() => setShowEmoji((v) => !v)}
          >
            <Smile className="size-5" />
          </Button>

          {/* Textarea */}
          <Textarea
            ref={textareaRef}
            placeholder={isRecording ? `Recording... ${fmtTime(recordingTime)}` : placeholder}
            value={content}
            onChange={handleTextChange}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setMentionState(null); return }
              if (e.key === "Enter" && !e.shiftKey && !mentionState) { e.preventDefault(); handleSend() }
            }}
            rows={rows}
            className="min-h-7 max-h-32 flex-1 min-w-0 resize-none border-none bg-transparent py-1.5 text-sm shadow-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
            disabled={disabled || isRecording}
          />

          {/* Attach button */}
          <div className="flex items-center shrink-0 mb-0.5">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="ghost" size="icon"
              className="size-8 text-muted-foreground hover:bg-transparent hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              title="Attach files"
            >
              <Paperclip className="size-5" />
            </Button>
          </div>
        </div>

        {/* Send / Mic button (green circle) */}
        {canSend ? (
          <Button
            size="icon"
            className="size-10 shrink-0 rounded-full shadow-sm sm:size-11"
            onClick={handleSend}
            disabled={sending}
            title="Send"
          >
            <Send className="size-5" />
          </Button>
        ) : (
          <Button
            size="icon"
            className={cn(
              "size-10 sm:size-11 rounded-full shrink-0 shadow-sm",
              isRecording
                ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            )}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={disabled || !!pendingAudio}
            title={isRecording ? `Stop recording (${fmtTime(recordingTime)})` : "Record voice message"}
          >
            {isRecording ? <Square className="size-5" /> : <Mic className="size-5" />}
          </Button>
        )}
      </div>

      {showEmoji && (
        <div className="rounded-2xl border border-border bg-card p-2 shadow-lg">
          <div className="grid grid-cols-6 sm:grid-cols-7 gap-1">
            {quickEmojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => insertEmoji(emoji)}
                className="size-8 rounded-md hover:bg-muted text-lg leading-none"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recording hint */}
      {isRecording && (
        <p className="text-center text-[10px] text-muted-foreground">
          Recording {fmtTime(recordingTime)} · tap stop when done
        </p>
      )}
    </div>
  )
}


