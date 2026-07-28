import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { callInclude, toCallRecord } from "@/lib/call/service"
import { emitCall } from "@/lib/call/signal"
import type { CallSignal } from "@/lib/call/types"

const schema = z.object({ callId: z.string().trim().min(1) })

/** Receiver answers. Marks the call accepted and tells the caller to connect. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const call = await prisma.call.findUnique({ where: { id: parsed.data.callId } })
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 })
  // Only the person being called can accept it.
  if (call.receiverId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (call.status !== "ringing") {
    // Already handled (caller canceled / rang out). Nothing to accept.
    return NextResponse.json({ error: "Call is no longer ringing" }, { status: 409 })
  }

  const updated = await prisma.call.update({
    where: { id: call.id },
    data: { status: "accepted", acceptedAt: new Date() },
    include: callInclude,
  })
  const record = toCallRecord(updated)

  const now = Date.now()
  emitCall(call.callerId, { event: "call:accepted", call: record, ts: now } satisfies CallSignal)
  // Echo to the receiver's other tabs so they all leave the incoming state.
  emitCall(call.receiverId, { event: "call:accepted", call: record, ts: now } satisfies CallSignal)

  return NextResponse.json({ call: record })
}
