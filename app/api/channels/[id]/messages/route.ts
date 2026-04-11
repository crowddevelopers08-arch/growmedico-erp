import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { pushNotification } from "@/lib/notifications"
import { parseDirectChannelName } from "@/lib/chat"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: channelId } = await params
  const channel = await prisma.channel.findUnique({ where: { id: channelId } })
  if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 })

  const directIds = parseDirectChannelName(channel.name)
  if (directIds && !directIds.includes(session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const after = searchParams.get("after")

  const messages = await prisma.message.findMany({
    where: {
      channelId,
      ...(after ? { createdAt: { gt: new Date(after) } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 100,
  })

  // Mark messages from others as read by current user.
  const unreadIds = messages
    .filter((m) => m.senderId !== session.user.id && !(m.readBy ?? []).includes(session.user.id))
    .map((m) => m.id)

  if (unreadIds.length > 0) {
    await Promise.all(
      unreadIds.map((id) =>
        prisma.message.update({
          where: { id },
          data: { readBy: { push: session.user.id } },
        }).catch(() => null)
      )
    )
    // Reflect read update in this response too.
    messages.forEach((m) => {
      if (unreadIds.includes(m.id)) {
        m.readBy = [...(m.readBy ?? []), session.user.id]
      }
    })
  }

  return NextResponse.json(messages)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: channelId } = await params
  const channel = await prisma.channel.findUnique({ where: { id: channelId } })
  if (!channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 })

  const directIds = parseDirectChannelName(channel.name)
  if (directIds && !directIds.includes(session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { content, audioContent, attachments, mentions } = body

  const hasContent = content?.trim() || audioContent || (attachments && attachments.length > 0)
  if (!hasContent) return NextResponse.json({ error: "Message content required" }, { status: 400 })

  const employee = session.user.employeeId
    ? await prisma.employee.findUnique({ where: { id: session.user.employeeId } })
    : null

  const senderName = employee?.name ?? session.user.name ?? session.user.email ?? "Unknown"
  const senderAvatar = employee?.avatar ?? null

  const message = await prisma.message.create({
    data: {
      channelId,
      senderId: session.user.id,
      senderName,
      senderAvatar,
      content: content?.trim() ?? "",
      audioContent: audioContent ?? null,
      attachments: attachments ?? undefined,
      mentions: mentions ?? [],
      readBy: [session.user.id],
    },
  })

  if (mentions && mentions.length > 0) {
    const preview = content?.trim()
      ? content.trim().slice(0, 80)
      : audioContent
      ? "[Voice message]"
      : "[Attachment]"
    for (const userId of mentions as string[]) {
      if (userId !== session.user.id) {
        await pushNotification(userId, {
          type: "mention",
          title: `Mentioned in #${channel?.name ?? "channel"}`,
          message: `${senderName}: ${preview}`,
          link: `/chat`,
        }).catch(() => {})
      }
    }
  }

  if (directIds) {
    const otherUserId = directIds.find((userId) => userId !== session.user.id)
    if (otherUserId) {
      const preview = content?.trim()
        ? content.trim().slice(0, 80)
        : audioContent
        ? "[Voice message]"
        : "[Attachment]"
      await pushNotification(otherUserId, {
        type: "message",
        title: `New message from ${senderName}`,
        message: preview,
        link: `/chat`,
      }).catch(() => {})
    }
  }

  return NextResponse.json(message)
}
