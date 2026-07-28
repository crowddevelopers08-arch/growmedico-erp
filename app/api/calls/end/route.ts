import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { callInclude, toCallRecord } from "@/lib/call/service"
import { emitCall } from "@/lib/call/signal"
import { deleteRoom } from "@/lib/call/livekit"
import type { CallSignal, CallStatus } from "@/lib/call/types"

const schema = z.object({
  callId: z.string().trim().min(1),
  // "missed" is sent by the caller's ring-timeout. Otherwise the final status is
  // inferred from who hung up and whether the call had been answered.
  reason: z.enum(["missed", "canceled"]).optional(),
})

const TERMINAL: CallStatus[] = ["rejected", "missed", "canceled", "ended", "busy", "failed"]

/**
 * Hang up. Handles every "stop" case with one endpoint:
 *   - answered call → ended (with duration)
 *   - ringing, caller hangs up → canceled
 *   - ringing, receiver hangs up → rejected
 *   - ringing, timed out → missed
 * Idempotent: a second call just returns the already-final record.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const call = await prisma.call.findUnique({ where: { id: parsed.data.callId } })
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 })
  // Only the two participants may end it.
  if (call.callerId !== userId && call.receiverId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (TERMINAL.includes(call.status as CallStatus)) {
    const current = await prisma.call.findUnique({ where: { id: call.id }, include: callInclude })
    return NextResponse.json({ call: current ? toCallRecord(current) : null })
  }

  const endedAt = new Date()
  let status: CallStatus
  let durationSec = 0

  if (call.status === "accepted") {
    status = "ended"
    if (call.acceptedAt) {
      durationSec = Math.max(0, Math.round((endedAt.getTime() - call.acceptedAt.getTime()) / 1000))
    }
  } else if (parsed.data.reason === "missed") {
    status = "missed"
  } else {
    // Ringing hang-up: caller aborting = canceled, receiver aborting = rejected.
    status = call.callerId === userId ? "canceled" : "rejected"
  }

  const updated = await prisma.call.update({
    where: { id: call.id },
    data: { status, endedAt, durationSec },
    include: callInclude,
  })
  const record = toCallRecord(updated)

  // Notify both sides so every open tab tears the call UI down. Missed also
  // fires call:missed at the receiver for its history/toast.
  const now = Date.now()
  emitCall(call.callerId, { event: "call:ended", call: record, reason: status, ts: now } satisfies CallSignal)
  emitCall(call.receiverId, { event: "call:ended", call: record, reason: status, ts: now } satisfies CallSignal)
  if (status === "missed") {
    emitCall(call.receiverId, { event: "call:missed", call: record, ts: now } satisfies CallSignal)
  }

  await deleteRoom(call.roomName)
  return NextResponse.json({ call: record })
}
