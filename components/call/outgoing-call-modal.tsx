"use client"

import { PhoneOff, Video, Phone } from "lucide-react"
import { useCallStore, selectPeer } from "@/lib/call/store"
import { useCallContext } from "./call-context"
import { UserAvatar } from "./user-avatar"

/** "Calling…" screen shown while an outgoing call rings. */
export function OutgoingCallModal() {
  const phase = useCallStore((s) => s.phase)
  const call = useCallStore((s) => s.call)
  const peer = useCallStore(selectPeer)
  const { hangUp } = useCallContext()

  // Shown while ringing and while the media room is being joined.
  if ((phase !== "outgoing" && phase !== "connecting") || !call || !peer) return null
  const isVideo = call.type === "video"

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="animate-in fade-in zoom-in-95 flex w-[min(92vw,26rem)] flex-col items-center gap-6 rounded-3xl border bg-card p-8 shadow-2xl duration-200">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isVideo ? <Video className="size-4" /> : <Phone className="size-4" />}
          {isVideo ? "Video" : "Voice"} call
        </div>

        <UserAvatar name={peer.name} avatar={peer.avatar} initials={peer.initials} size="xl" pulse />

        <div className="text-center">
          <p className="text-xl font-semibold wrap-break-word">{peer.name}</p>
          <p className="text-sm text-muted-foreground">
            {phase === "connecting" ? "Connecting…" : "Ringing…"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => hangUp("canceled")}
          aria-label="Cancel call"
          className="mt-2 inline-flex size-14 items-center justify-center rounded-full bg-destructive text-white transition-colors hover:bg-destructive/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <PhoneOff className="size-6" />
        </button>
      </div>
    </div>
  )
}
