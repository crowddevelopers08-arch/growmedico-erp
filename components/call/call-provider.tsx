"use client"

// Mount once, high in the tree (below SessionProvider). Owns the signaling
// controller and the LiveKit room, exposes both through CallContext, and renders
// whichever call surface matches the current phase. Everything call-related
// hangs off this one provider.

import { useCallback } from "react"
import { toast } from "sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useCall } from "@/lib/call/use-call"
import { useLiveKitRoom } from "@/lib/call/use-livekit-room"
import { useCallStore } from "@/lib/call/store"
import { CallContext } from "./call-context"
import { IncomingCallModal } from "./incoming-call-modal"
import { OutgoingCallModal } from "./outgoing-call-modal"
import { VoiceCallWindow } from "./voice-call-window"
import { VideoCallWindow } from "./video-call-window"
import { FloatingMiniCall } from "./floating-mini-call"

export function CallProvider({ children }: { children: React.ReactNode }) {
  const controller = useCall()

  const phase = useCallStore((s) => s.phase)
  const call = useCallStore((s) => s.call)
  const token = useCallStore((s) => s.token)
  const serverUrl = useCallStore((s) => s.serverUrl)

  // Any fatal media error tears the call down cleanly for both sides.
  const onFatal = useCallback(
    (message: string) => {
      toast.error(message)
      void controller.hangUp()
    },
    [controller],
  )

  // Connect to LiveKit only once we hold a token (connecting/active phases).
  const lk = useLiveKitRoom({
    token,
    serverUrl,
    isVideo: call?.type === "video",
    enabled: phase === "connecting" || phase === "active",
    onFatal,
  })

  return (
    <CallContext.Provider
      value={{
        ...controller,
        media: {
          tracks: lk.tracks,
          toggleMic: lk.toggleMic,
          toggleCamera: lk.toggleCamera,
          toggleScreenShare: lk.toggleScreenShare,
          switchCamera: lk.switchCamera,
        },
      }}
    >
      <TooltipProvider delayDuration={200}>
        {children}
        {/* Call surfaces — each self-hides unless its phase is current. */}
        <IncomingCallModal />
        <OutgoingCallModal />
        <VoiceCallWindow />
        <VideoCallWindow />
        <FloatingMiniCall />
      </TooltipProvider>
    </CallContext.Provider>
  )
}
