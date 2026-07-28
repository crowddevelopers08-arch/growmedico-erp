"use client"

import { Phone, Video } from "lucide-react"
import { useCallStore, selectPeer } from "@/lib/call/store"
import { useCallContext } from "./call-context"
import { UserAvatar } from "./user-avatar"
import { AnswerControls } from "./call-controls"

/** Full-screen incoming-call prompt with answer / decline. */
export function IncomingCallModal() {
  const phase = useCallStore((s) => s.phase)
  const call = useCallStore((s) => s.call)
  const peer = useCallStore(selectPeer)
  const { acceptCall, rejectCall } = useCallContext()

  if (phase !== "incoming" || !call || !peer) return null
  const isVideo = call.type === "video"

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="animate-in fade-in zoom-in-95 flex w-[min(92vw,26rem)] flex-col items-center gap-6 rounded-3xl border bg-card p-8 shadow-2xl duration-200">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isVideo ? <Video className="size-4" /> : <Phone className="size-4" />}
          Incoming {isVideo ? "video" : "voice"} call
        </div>

        <UserAvatar name={peer.name} avatar={peer.avatar} initials={peer.initials} size="xl" pulse />

        <div className="text-center">
          <p className="text-xl font-semibold wrap-break-word">{peer.name}</p>
          <p className="text-sm text-muted-foreground">is calling you…</p>
        </div>

        <AnswerControls className="mt-2" onAccept={acceptCall} onReject={rejectCall} />
      </div>
    </div>
  )
}
