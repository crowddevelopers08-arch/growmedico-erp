"use client"

// The signaling brain. Opens the SSE call channel, turns incoming signals into
// store transitions, plays/stops ring tones, tracks who's online, and exposes
// the imperative actions (start / accept / reject / cancel / end). One instance,
// mounted by CallProvider.

import { useCallback, useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { useCallStore, selectPeer } from "./store"
import { playRingtone, stopRingtone } from "./ringtone"
import { RING_TIMEOUT_MS, type CallSignal, type CallType } from "./types"

async function postJson<T>(url: string, body: unknown): Promise<{ ok: boolean; data: T }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = (await res.json().catch(() => ({}))) as T
  return { ok: res.ok, data }
}

export interface CallController {
  online: Set<string>
  isOnline: (userId: string) => boolean
  startCall: (receiverId: string, type: CallType) => Promise<void>
  acceptCall: () => Promise<void>
  rejectCall: () => Promise<void>
  /** Cancel an outgoing ring, or hang up an active call — one action for both. */
  hangUp: (reason?: "missed" | "canceled") => Promise<void>
}

export function useCall(): CallController {
  const { data: session } = useSession()
  const selfId = session?.user?.id ?? null

  const store = useCallStore()
  const {
    setSelf, startOutgoing, receiveIncoming, setConnecting, endLocal,
  } = store

  const [online, setOnline] = useState<Set<string>>(new Set())
  // Ring timeout handle for the outgoing side → marks missed if unanswered.
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Latest store snapshot for use inside the SSE handler without re-subscribing.
  const stateRef = useRef(store)
  stateRef.current = store

  const clearRingTimer = useCallback(() => {
    if (ringTimer.current) {
      clearTimeout(ringTimer.current)
      ringTimer.current = null
    }
  }, [])

  // Fetch a LiveKit token, then move to the connecting phase.
  const connectToRoom = useCallback(async (roomName: string) => {
    const { ok, data } = await postJson<{ token?: string; url?: string; error?: string }>(
      "/api/livekit/token",
      { roomName },
    )
    if (!ok || !data.token || !data.url) {
      toast.error(data.error ?? "Couldn't join the call")
      endLocal()
      return
    }
    setConnecting(data.token, data.url)
  }, [endLocal, setConnecting])

  // ── Actions ───────────────────────────────────────────────────────────
  const startCall = useCallback(async (receiverId: string, type: CallType) => {
    if (stateRef.current.phase !== "idle") {
      toast.error("You're already on a call")
      return
    }
    const { ok, data } = await postJson<{ status?: string; call?: import("./types").CallRecord; error?: string; message?: string }>(
      "/api/calls/start",
      { receiverId, type },
    )
    if (!ok || !data.call) {
      if (data.status === "busy") toast.error("They're on another call")
      else toast.error(data.message ?? data.error ?? "Couldn't start the call")
      return
    }
    startOutgoing(data.call)
    playRingtone("outgoing")
    // Auto-give-up if they never answer.
    clearRingTimer()
    ringTimer.current = setTimeout(() => {
      void postJson("/api/calls/end", { callId: data.call!.id, reason: "missed" })
    }, RING_TIMEOUT_MS)
  }, [startOutgoing, clearRingTimer])

  const acceptCall = useCallback(async () => {
    const call = stateRef.current.call
    if (!call) return
    stopRingtone()
    const { ok, data } = await postJson<{ call?: import("./types").CallRecord; error?: string }>(
      "/api/calls/accept",
      { callId: call.id },
    )
    if (!ok) {
      toast.error(data.error ?? "Couldn't accept")
      endLocal()
      return
    }
    await connectToRoom(call.roomName)
  }, [connectToRoom, endLocal])

  const rejectCall = useCallback(async () => {
    const call = stateRef.current.call
    if (!call) return
    stopRingtone()
    await postJson("/api/calls/reject", { callId: call.id })
    endLocal()
  }, [endLocal])

  const hangUp = useCallback(async (reason?: "missed" | "canceled") => {
    const call = stateRef.current.call
    clearRingTimer()
    stopRingtone()
    if (call) {
      await postJson("/api/calls/end", { callId: call.id, reason })
    }
    endLocal()
  }, [clearRingTimer, endLocal])

  // ── Presence bootstrap ────────────────────────────────────────────────
  useEffect(() => {
    if (!selfId) return
    setSelf(selfId)
    fetch("/api/calls/online")
      .then((r) => (r.ok ? r.json() : { userIds: [] }))
      .then((d: { userIds: string[] }) => setOnline(new Set(d.userIds)))
      .catch(() => {})
  }, [selfId, setSelf])

  // ── SSE signaling channel ─────────────────────────────────────────────
  useEffect(() => {
    if (!selfId) return
    const es = new EventSource("/api/calls/stream")

    es.onmessage = (e) => {
      let signal: CallSignal
      try {
        signal = JSON.parse(e.data)
      } catch {
        return
      }

      switch (signal.event) {
        case "user:online":
          if (signal.userId) setOnline((s) => new Set(s).add(signal.userId!))
          break
        case "user:offline":
          if (signal.userId)
            setOnline((s) => {
              const next = new Set(s)
              next.delete(signal.userId!)
              return next
            })
          break

        case "call:initiate": {
          if (!signal.call) break
          // Already busy locally → auto-reject so the caller learns instantly.
          if (stateRef.current.phase !== "idle") {
            void postJson("/api/calls/reject", { callId: signal.call.id })
            break
          }
          receiveIncoming(signal.call)
          playRingtone("incoming")
          break
        }

        case "call:ringing":
          // Our outgoing call is confirmed ringing — ringback already playing.
          break

        case "call:accepted": {
          if (!signal.call) break
          clearRingTimer()
          stopRingtone()
          // Caller connects on accept; the receiver connected in acceptCall().
          if (signal.call.caller.userId === selfId) void connectToRoom(signal.call.roomName)
          break
        }

        case "call:busy":
          stopRingtone()
          clearRingTimer()
          toast.error("They're on another call")
          endLocal()
          break

        case "call:rejected":
          stopRingtone()
          clearRingTimer()
          toast("Call declined")
          endLocal()
          break

        case "call:missed": {
          // We are the receiver who never picked up.
          const peer = selectPeer(stateRef.current)
          stopRingtone()
          endLocal()
          toast(`Missed call${peer ? ` from ${peer.name}` : ""}`)
          break
        }

        case "call:ended": {
          stopRingtone()
          clearRingTimer()
          const wasActive = stateRef.current.phase === "active"
          const reason = signal.reason
          endLocal()
          if (reason === "canceled" && !wasActive) toast("Call canceled")
          else if (reason === "missed") {
            /* handled by call:missed at the receiver */
          } else if (wasActive) toast("Call ended")
          break
        }
      }
    }

    return () => es.close()
    // selfId is the only real dependency; the callbacks are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfId])

  const isOnline = useCallback((userId: string) => online.has(userId), [online])

  return { online, isOnline, startCall, acceptCall, rejectCall, hangUp }
}
