// Server-side call domain logic shared by every route: how to load a call with
// the display info the UI needs, how to serialize it, and the busy check. Keeps
// the route handlers thin (they only do auth + orchestration).

import "server-only"
import { prisma } from "@/lib/prisma"
import { RING_TIMEOUT_MS, type CallRecord, type CallStatus, type CallType } from "./types"

/** The exact user shape needed to render a call party. */
const partySelect = {
  id: true,
  email: true,
  employee: { select: { name: true, avatar: true, initials: true } },
} as const

/** Prisma include that pulls both parties' display info in one query. */
export const callInclude = {
  caller: { select: partySelect },
  receiver: { select: partySelect },
} as const

type PartyRow = {
  id: string
  email: string
  employee: { name: string; avatar: string | null; initials: string } | null
}

type CallRow = {
  id: string
  roomName: string
  type: string
  status: string
  startedAt: Date
  acceptedAt: Date | null
  endedAt: Date | null
  durationSec: number
  createdAt: Date
  caller: PartyRow
  receiver: PartyRow
}

function toParty(user: PartyRow) {
  return {
    userId: user.id,
    name: user.employee?.name ?? user.email,
    avatar: user.employee?.avatar ?? null,
    initials: user.employee?.initials ?? user.email.slice(0, 2).toUpperCase(),
  }
}

/** Serialize a Prisma row (with callInclude) into the wire CallRecord. */
export function toCallRecord(row: CallRow): CallRecord {
  return {
    id: row.id,
    roomName: row.roomName,
    type: row.type as CallType,
    status: row.status as CallStatus,
    caller: toParty(row.caller),
    receiver: toParty(row.receiver),
    startedAt: row.startedAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    endedAt: row.endedAt?.toISOString() ?? null,
    durationSec: row.durationSec,
    createdAt: row.createdAt.toISOString(),
  }
}

/** Statuses that mean a user is currently tied up in a call. */
export const LIVE_STATUSES = ["ringing", "accepted"] as const

// A ringing call past this age never rang through — grace beyond the client's
// ring timeout. An accepted call older than the hard cap is treated as orphaned
// (a client crashed without hanging up); real 1:1 calls never run this long.
const RING_STALE_MS = RING_TIMEOUT_MS + 10_000
const ACCEPTED_STALE_MS = 6 * 60 * 60 * 1000

/**
 * Finalize calls that were abandoned without a proper hang-up, so a crashed or
 * force-closed client can't leave a row that blocks all future calls. Safe to
 * call on every start; it only touches genuinely stale rows.
 */
export async function sweepStaleCalls(): Promise<void> {
  const now = Date.now()
  await prisma.call.updateMany({
    where: { status: "ringing", startedAt: { lt: new Date(now - RING_STALE_MS) } },
    data: { status: "missed", endedAt: new Date() },
  })
  await prisma.call.updateMany({
    where: { status: "accepted", startedAt: { lt: new Date(now - ACCEPTED_STALE_MS) } },
    data: { status: "ended", endedAt: new Date() },
  })
}

/** Force-finalize any live call this user is still attached to. Called when
 *  they start a fresh call — a prior unfinished row is by definition abandoned. */
export async function endUserLiveCalls(userId: string): Promise<void> {
  await prisma.call.updateMany({
    where: {
      status: { in: [...LIVE_STATUSES] },
      OR: [{ callerId: userId }, { receiverId: userId }],
    },
    data: { status: "ended", endedAt: new Date() },
  })
}

/**
 * Is this user already in a live call? Ringing rows past the stale window are
 * ignored so a timed-out invite never reads as busy.
 */
export async function isUserBusy(userId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - RING_STALE_MS)
  const live = await prisma.call.findFirst({
    where: {
      OR: [{ callerId: userId }, { receiverId: userId }],
      AND: [
        {
          OR: [
            { status: "accepted" },
            { status: "ringing", startedAt: { gte: cutoff } },
          ],
        },
      ],
    },
    select: { id: true },
  })
  return !!live
}

/** Load a single call with display info, or null. */
export async function getCall(id: string): Promise<CallRecord | null> {
  const row = await prisma.call.findUnique({ where: { id }, include: callInclude })
  return row ? toCallRecord(row) : null
}

/** The other party's user id, from the caller's perspective and vice versa. */
export function peerOf(call: CallRecord, userId: string): string {
  return call.caller.userId === userId ? call.receiver.userId : call.caller.userId
}
