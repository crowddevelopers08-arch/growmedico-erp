"use client"

import { Minus } from "lucide-react"
import { useCallStore, selectPeer } from "@/lib/call/store"
import { useCallContext } from "./call-context"
import { UserAvatar } from "./user-avatar"
import { CallTimer } from "./call-timer"
import { CallControls } from "./call-controls"
import { NetworkQuality } from "./status-badge"

/** In-call screen for a voice call. */
export function VoiceCallWindow() {
  const phase = useCallStore((s) => s.phase)
  const call = useCallStore((s) => s.call)
  const peer = useCallStore(selectPeer)
  const media = useCallStore((s) => s.media)
  const quality = useCallStore((s) => s.quality)
  const reconnecting = useCallStore((s) => s.reconnecting)
  const remoteJoined = useCallStore((s) => s.remoteJoined)
  const connectedAt = useCallStore((s) => s.connectedAt)
  const minimized = useCallStore((s) => s.minimized)
  const setMinimized = useCallStore((s) => s.setMinimized)

  const { hangUp, media: lk } = useCallContext()

  const active = (phase === "active" || phase === "connecting") && call?.type === "voice"
  if (!active || !call || !peer || minimized) return null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-background/95 p-8 backdrop-blur-sm">
      {/* Top bar */}
      <div className="flex w-full max-w-md items-center justify-between">
        <NetworkQuality quality={quality} reconnecting={reconnecting} showLabel />
        <button
          type="button"
          onClick={() => setMinimized(true)}
          aria-label="Minimize"
          className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
        >
          <Minus className="size-5" />
        </button>
      </div>

      {/* Person */}
      <div className="flex flex-col items-center gap-5">
        <UserAvatar name={peer.name} avatar={peer.avatar} initials={peer.initials} size="xl" pulse={!remoteJoined} />
        <div className="text-center">
          <p className="text-2xl font-semibold wrap-break-word">{peer.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {reconnecting ? "Reconnecting…" : !remoteJoined ? "Connecting…" : <CallTimer startedAt={connectedAt} />}
          </p>
        </div>
      </div>

      {/* Controls */}
      <CallControls
        variant="voice"
        micEnabled={media.micEnabled}
        onToggleMic={lk.toggleMic}
        onEnd={() => hangUp()}
      />
    </div>
  )
}
