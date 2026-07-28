import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { randomUUID } from "crypto"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { callInclude, isUserBusy, toCallRecord } from "@/lib/call/service"
import { emitCall, isUserOnline } from "@/lib/call/signal"
import { ensureRoom } from "@/lib/call/livekit"
import type { CallSignal } from "@/lib/call/types"

const startSchema = z.object({
  receiverId: z.string().trim().min(1, "receiverId is required"),
  type: z.enum(["voice", "video"]),
})

/**
 * Place a call. Validates the receiver, guards against calling yourself,
 * offline peers, and busy peers, then creates the Call row + LiveKit room and
 * rings the receiver over SSE.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const callerId = session.user.id

  const parsed = startSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 })
  }
  const { receiverId, type } = parsed.data

  if (receiverId === callerId) {
    return NextResponse.json({ error: "You can't call yourself" }, { status: 400 })
  }

  const receiver = await prisma.user.findUnique({ where: { id: receiverId }, select: { id: true } })
  if (!receiver) return NextResponse.json({ error: "User not found" }, { status: 404 })

  // The caller can't already be on a call, and the receiver must be free.
  if (await isUserBusy(callerId)) {
    return NextResponse.json({ error: "You're already on a call" }, { status: 409 })
  }
  if (!isUserOnline(receiverId)) {
    return NextResponse.json({ error: "offline", message: "This person is offline" }, { status: 409 })
  }
  if (await isUserBusy(receiverId)) {
    // Record the attempt as busy so it shows in history, and tell the caller.
    const busyCall = await prisma.call.create({
      data: { roomName: `call_${randomUUID()}`, callerId, receiverId, type, status: "busy", endedAt: new Date() },
      include: callInclude,
    })
    return NextResponse.json({ status: "busy", call: toCallRecord(busyCall) }, { status: 409 })
  }

  const roomName = `call_${randomUUID()}`
  await ensureRoom(roomName)

  const call = await prisma.call.create({
    data: { roomName, callerId, receiverId, type, status: "ringing" },
    include: callInclude,
  })
  const record = toCallRecord(call)

  // Ring the receiver, and confirm to the caller that it's ringing.
  const now = Date.now()
  emitCall(receiverId, { event: "call:initiate", call: record, ts: now } satisfies CallSignal)
  emitCall(callerId, { event: "call:ringing", call: record, ts: now } satisfies CallSignal)

  return NextResponse.json({ status: "ringing", call: record }, { status: 201 })
}
