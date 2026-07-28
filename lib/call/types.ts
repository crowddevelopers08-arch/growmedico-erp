// Shared call domain types. Server (API routes, signaling) and client (store,
// hooks, components) both import from here so the wire format can't drift.

export type CallType = "voice" | "video"

/**
 * Full lifecycle of a call. Only `ringing`/`accepted` are "live"; the rest are
 * terminal and what gets shown in history.
 */
export type CallStatus =
  | "ringing" // invite sent, waiting for the receiver
  | "accepted" // answered, media connected
  | "rejected" // receiver declined
  | "missed" // rang out with no answer
  | "canceled" // caller hung up before it was answered
  | "ended" // normal hang-up after being answered
  | "busy" // receiver was already on another call
  | "failed" // media/connection error

/** A person shown in the call UI — resolved from the User's linked Employee. */
export interface CallParty {
  userId: string
  name: string
  avatar?: string | null
  initials: string
}

/** A call record as returned by the API (history + live state). */
export interface CallRecord {
  id: string
  roomName: string
  type: CallType
  status: CallStatus
  caller: CallParty
  receiver: CallParty
  startedAt: string
  acceptedAt?: string | null
  endedAt?: string | null
  durationSec: number
  createdAt: string
}

// ── Signaling events (server → client over SSE) ───────────────────────────
// Names mirror the classic socket event set, kept stable for readability.

export type SignalEventName =
  | "call:initiate" // you're being called
  | "call:ringing" // your outgoing call is now ringing on their side
  | "call:accepted" // the other side answered
  | "call:rejected" // the other side declined
  | "call:ended" // the other side hung up (or the call was canceled/missed)
  | "call:busy" // the person you called is already in a call
  | "call:missed" // your incoming call rang out
  | "user:online"
  | "user:offline"
  | "signal:connected" // SSE handshake ack

export interface CallSignal {
  event: SignalEventName
  /** The call this signal is about. Absent on presence/handshake events. */
  call?: CallRecord
  /** For presence events. */
  userId?: string
  /** Terminal reason so the UI can show "Missed", "Declined", etc. */
  reason?: CallStatus
  /** Server clock so clients can align timers/timeouts. */
  ts: number
}

/** How long an unanswered call rings before it's auto-marked missed (ms). */
export const RING_TIMEOUT_MS = 35_000
