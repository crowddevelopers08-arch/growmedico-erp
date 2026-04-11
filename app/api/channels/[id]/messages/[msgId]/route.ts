import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseDirectChannelName } from "@/lib/chat"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { msgId } = await params
  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 })

  const message = await prisma.message.findUnique({ where: { id: msgId } })
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const channel = await prisma.channel.findUnique({ where: { id: message.channelId } })
  if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 })
  const directIds = parseDirectChannelName(channel.name)
  if (directIds && !directIds.includes(session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (message.senderId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const updated = await prisma.message.update({
    where: { id: msgId },
    data: { content: content.trim(), editedAt: new Date() },
  })
  return NextResponse.json(updated)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; msgId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { msgId } = await params
  const message = await prisma.message.findUnique({ where: { id: msgId } })
  if (!message) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const channel = await prisma.channel.findUnique({ where: { id: message.channelId } })
  if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 })
  const directIds = parseDirectChannelName(channel.name)
  if (directIds && !directIds.includes(session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (message.senderId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.message.delete({ where: { id: msgId } })
  return NextResponse.json({ success: true })
}
