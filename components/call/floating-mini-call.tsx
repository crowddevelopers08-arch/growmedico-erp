"use client"

import { Maximize2, Mic, MicOff, PhoneOff } from "lucide-react"
import { useCallStore, selectPeer } from "@/lib/call/store"
import { useCallContext } from "./call-context"
import { UserAvatar } from "./user-avatar"
import { CallTimer } from "./call-timer"
import { cn } from "@/lib/utils"

/** Draggable-free floating pill shown when an active call is minimized, so the
 *  user can keep working. Click to restore the full window. */
export function FloatingMiniCall() {
  const phase = useCallStore((s) => s.phase)
  const call = useCallStore((s) => s.call)
  const peer = useCallStore(selectPeer)
  const media = useCallStore((s) => s.media)
  const connectedAt = useCallStore((s) => s.connectedAt)
  const minimized = useCallStore((s) => s.minimized)
  const setMinimized = useCallStore((s) => s.setMinimized)
  const { hangUp, media: lk } = useCallContext()

  const active = phase === "active" || phase === "connecting"
  if (!active || !minimized || !call || !peer) return null

  return (
    <div className="animate-in slide-in-from-bottom-4 fixed right-4 bottom-4 z-[100] flex items-center gap-3 rounded-2xl border bg-card p-2.5 pr-3 shadow-2xl duration-200">
      <button
        type="button"
        onClick={() => setMinimized(false)}
        className="flex items-center gap-3"
        aria-label="Expand call"
      >
        <UserAvatar name={peer.name} avatar={peer.avatar} initials={peer.initials} size="md" />
        <div className="min-w-0 text-left">
          <p className="truncate text-sm font-medium">{peer.name}</p>
          <p className="text-xs text-muted-foreground">
            <CallTimer startedAt={connectedAt} />
          </p>
        </div>
      </button>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={lk.toggleMic}
          aria-label={media.micEnabled ? "Mute" : "Unmute"}
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-full",
            media.micEnabled ? "text-foreground hover:bg-accent" : "bg-foreground/10 text-foreground",
          )}
        >
          {media.micEnabled ? <Mic className="size-4" /> : <MicOff className="size-4" />}
        </button>
        <button
          type="button"
          onClick={() => setMinimized(false)}
          aria-label="Expand"
          className="inline-flex size-8 items-center justify-center rounded-full text-foreground hover:bg-accent"
        >
          <Maximize2 className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => hangUp()}
          aria-label="End call"
          className="inline-flex size-8 items-center justify-center rounded-full bg-destructive text-white hover:bg-destructive/90"
        >
          <PhoneOff className="size-4" />
        </button>
      </div>
    </div>
  )
}
