import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { callInclude, toCallRecord } from "@/lib/call/service"
import { emitCall } from "@/lib/call/signal"
import { deleteRoom } from "@/lib/call/livekit"
import type { CallSignal } from "@/lib/call/types"

const schema = z.object({ callId: z.string().trim().min(1) })

/** Receiver declines a ringing call. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const call = await prisma.call.findUnique({ where: { id: parsed.data.callId } })
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 })
  if (call.receiverId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Idempotent: if it already resolved, just return it.
  if (call.status !== "ringing") {
    const current = await prisma.call.findUnique({ where: { id: call.id }, include: callInclude })
    return NextResponse.json({ call: current ? toCallRecord(current) : null })
  }

  const updated = await prisma.call.update({
    where: { id: call.id },
    data: { status: "rejected", endedAt: new Date() },
    include: callInclude,
  })
  const record = toCallRecord(updated)

  const now = Date.now()
  emitCall(call.callerId, { event: "call:rejected", call: record, reason: "rejected", ts: now } satisfies CallSignal)
  emitCall(call.receiverId, { event: "call:ended", call: record, reason: "rejected", ts: now } satisfies CallSignal)

  await deleteRoom(call.roomName)
  return NextResponse.json({ call: record })
}
