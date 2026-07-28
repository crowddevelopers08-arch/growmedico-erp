import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createJoinToken } from "@/lib/call/livekit"

const schema = z.object({ roomName: z.string().trim().min(1) })

/**
 * Issue a LiveKit join token — but only to a participant of a live call for that
 * room. This is the security boundary: without it anyone could mint a token for
 * any room. Identity is the user id so LiveKit participants map back to users.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

  const call = await prisma.call.findUnique({ where: { roomName: parsed.data.roomName } })
  if (!call) return NextResponse.json({ error: "Room not found" }, { status: 404 })
  if (call.callerId !== userId && call.receiverId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  // Tokens are only useful while the call is live.
  if (call.status !== "ringing" && call.status !== "accepted") {
    return NextResponse.json({ error: "Call is not active" }, { status: 409 })
  }

  try {
    const token = await createJoinToken({
      roomName: call.roomName,
      identity: userId,
      name: session.user.name ?? session.user.email,
      canPublishVideo: call.type === "video",
    })
    return NextResponse.json({ token, url: process.env.NEXT_PUBLIC_LIVEKIT_URL })
  } catch (err) {
    console.error("[livekit/token]", err)
    return NextResponse.json({ error: "LiveKit is not configured" }, { status: 500 })
  }
}
