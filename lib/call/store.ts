"use client"

// The single source of truth for the active call on the client. Zustand keeps
// it outside React so the signaling hook, the LiveKit hook, and every call
// component read/write the same state without prop-drilling or context churn.

import { create } from "zustand"
import type { CallRecord, CallType } from "./types"

/** The call UI's high-level phase. Drives which window/modal renders. */
export type CallPhase =
  | "idle" // nothing happening
  | "outgoing" // we placed a call, waiting for them
  | "incoming" // someone's calling us
  | "connecting" // accepted, joining the LiveKit room
  | "active" // media flowing
  | "ended" // brief terminal state before returning to idle

export type ConnectionQuality = "excellent" | "good" | "poor" | "lost" | "unknown"

export interface MediaState {
  micEnabled: boolean
  cameraEnabled: boolean
  screenSharing: boolean
  /** Output routing hint for mobile (speaker vs earpiece); best-effort. */
  speakerOn: boolean
}

interface CallState {
  phase: CallPhase
  call: CallRecord | null
  /** Set once we hold a LiveKit token for this room. */
  token: string | null
  serverUrl: string | null
  media: MediaState
  quality: ConnectionQuality
  /** LiveKit reconnecting after a network blip. */
  reconnecting: boolean
  /** Remote peer has actually joined the room and is publishing. */
  remoteJoined: boolean
  /** UNIX ms when media connected — the call timer counts from here. */
  connectedAt: number | null
  /** Minimized to the floating pill. */
  minimized: boolean
  /** Who this session is in the call (needed to resolve "the other person"). */
  selfUserId: string | null

  // actions
  setSelf: (userId: string) => void
  startOutgoing: (call: CallRecord) => void
  receiveIncoming: (call: CallRecord) => void
  setConnecting: (token: string, serverUrl: string) => void
  setActive: () => void
  setRemoteJoined: (joined: boolean) => void
  setQuality: (q: ConnectionQuality) => void
  setReconnecting: (v: boolean) => void
  patchMedia: (patch: Partial<MediaState>) => void
  setMinimized: (v: boolean) => void
  endLocal: () => void // clear everything back to idle
}

const initialMedia = (type: CallType): MediaState => ({
  micEnabled: true,
  cameraEnabled: type === "video",
  screenSharing: false,
  speakerOn: true,
})

export const useCallStore = create<CallState>((set) => ({
  phase: "idle",
  call: null,
  token: null,
  serverUrl: null,
  media: initialMedia("voice"),
  quality: "unknown",
  reconnecting: false,
  remoteJoined: false,
  connectedAt: null,
  minimized: false,
  selfUserId: null,

  setSelf: (userId) => set({ selfUserId: userId }),

  startOutgoing: (call) =>
    set({ phase: "outgoing", call, media: initialMedia(call.type), minimized: false, remoteJoined: false }),

  receiveIncoming: (call) =>
    set({ phase: "incoming", call, media: initialMedia(call.type), minimized: false, remoteJoined: false }),

  setConnecting: (token, serverUrl) => set({ phase: "connecting", token, serverUrl }),

  setActive: () => set({ phase: "active", connectedAt: Date.now() }),

  setRemoteJoined: (joined) => set({ remoteJoined: joined }),
  setQuality: (quality) => set({ quality }),
  setReconnecting: (reconnecting) => set({ reconnecting }),

  patchMedia: (patch) => set((s) => ({ media: { ...s.media, ...patch } })),

  setMinimized: (minimized) => set({ minimized }),

  endLocal: () =>
    set({
      phase: "idle",
      call: null,
      token: null,
      serverUrl: null,
      quality: "unknown",
      reconnecting: false,
      remoteJoined: false,
      connectedAt: null,
      minimized: false,
    }),
}))

/** The other participant, from this session's point of view. */
export function selectPeer(state: CallState) {
  if (!state.call || !state.selfUserId) return null
  return state.call.caller.userId === state.selfUserId ? state.call.receiver : state.call.caller
}
