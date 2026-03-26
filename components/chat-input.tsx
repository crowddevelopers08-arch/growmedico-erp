"use client"

import { useState, useRef, useCallback } from "react"
import { Send, Mic, Square, Paperclip, X, Play, Pause, FileText } from "lucide-react"
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

export function ChatInput({ placeholder = "Type a message...", users, disabled, onSend, rows = 2 }: ChatInputProps) {
  const [content, setContent] = useState("")
  const [mentionIds, setMentionIds] = useState<string[]>([])
  const [mentionState, setMentionState] = useState<{ start: number; query: string } | null>(null)
  const [pendingAudio, setPendingAudio] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [sending, setSending] = useState(false)
  const [audioPlaying, setAudioPlaying] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

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
      setContent(`${before}<@${user.userId}|${user.name}> ${after}`)
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

  const fmtTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`
  const canSend = (content.trim() || pendingAudio || attachments.length > 0) && !sending && !disabled && !isRecording

  return (
    <div className="space-y-2">
      {pendingAudio && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border">
          <Mic className="size-4 text-primary shrink-0" />
          <audio ref={audioRef} src={pendingAudio} onEnded={() => setAudioPlaying(false)} className="hidden" />
          <Button variant="ghost" size="icon" className="size-6" onClick={() => {
            if (!audioRef.current) return
            if (audioPlaying) { audioRef.current.pause(); setAudioPlaying(false) }
            else { audioRef.current.play(); setAudioPlaying(true) }
          }}>
            {audioPlaying ? <Pause className="size-3" /> : <Play className="size-3" />}
          </Button>
          <span className="text-xs text-muted-foreground flex-1">Voice message ready</span>
          <Button variant="ghost" size="icon" className="size-6" onClick={() => setPendingAudio(null)}>
            <X className="size-3" />
          </Button>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att, i) => (
            <div key={i} className="relative group">
              {att.type.startsWith("image/") ? (
                <img src={att.data} alt={att.name} className="size-16 object-cover rounded-lg border" />
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-1.5 bg-muted/50 rounded-lg border text-xs max-w-[9rem]">
                  <FileText className="size-3.5 text-muted-foreground shrink-0" />
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

      {mentionState && filteredUsers.length > 0 && (
        <div className="border border-border rounded-lg bg-popover shadow-md overflow-hidden max-h-48 overflow-y-auto">
          {filteredUsers.map((user) => (
            <button
              key={user.userId}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
              onMouseDown={(e) => { e.preventDefault(); selectMention(user) }}
            >
              <Avatar className="size-6">
                <AvatarImage src={user.avatar ?? undefined} />
                <AvatarFallback className="text-[9px]">{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span>{user.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
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
          className="flex-1 resize-none text-sm"
          disabled={disabled || isRecording}
        />
        <div className="flex items-center gap-1 pb-0.5">
          <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" className="hidden" onChange={handleFileSelect} />
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => fileInputRef.current?.click()} disabled={disabled} title="Attach files">
            <Paperclip className="size-4" />
          </Button>
          <Button
            variant={isRecording ? "destructive" : "ghost"}
            size="icon"
            className={cn("size-8", !isRecording && "text-muted-foreground hover:text-foreground")}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={disabled || !!pendingAudio}
            title={isRecording ? `Stop (${fmtTime(recordingTime)})` : "Record voice"}
          >
            {isRecording ? <Square className="size-4" /> : <Mic className="size-4" />}
          </Button>
          <Button size="icon" className="size-8" onClick={handleSend} disabled={!canSend}>
            <Send className="size-4" />
          </Button>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        {isRecording
          ? `Recording ${fmtTime(recordingTime)} — click stop when done`
          : "Enter to send · Shift+Enter for newline · @ to mention"}
      </p>
    </div>
  )
}
