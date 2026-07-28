"use client"

import { createContext, useContext } from "react"
import type { CallController } from "@/lib/call/use-call"
import type { LiveKitControls } from "@/lib/call/use-livekit-room"

/**
 * Everything the call UI needs, composed by CallProvider: signaling actions
 * (start/accept/reject/hangUp + presence) and the live media controls/tracks.
 * Reactive state (phase, media flags, timer) comes from useCallStore directly.
 */
export interface CallContextValue extends CallController {
  media: Pick<LiveKitControls, "tracks" | "toggleMic" | "toggleCamera" | "toggleScreenShare" | "switchCamera">
}

export const CallContext = createContext<CallContextValue | null>(null)

export function useCallContext(): CallContextValue {
  const ctx = useContext(CallContext)
  if (!ctx) throw new Error("useCallContext must be used within <CallProvider>")
  return ctx
}
