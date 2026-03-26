import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { pushNotification } from "@/lib/notifications"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: taskId } = await params

  if (session.user.role !== "ADMIN") {
    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task || task.assignedToId !== session.user.employeeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const comments = await prisma.taskComment.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json(comments)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: taskId } = await params
  const body = await req.json()
  const { content, audioContent, attachments, mentions } = body

  const hasContent = content?.trim() || audioContent || (attachments && attachments.length > 0)
  if (!hasContent) return NextResponse.json({ error: "Content required" }, { status: 400 })

  if (session.user.role !== "ADMIN") {
    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task || task.assignedToId !== session.user.employeeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const employee = session.user.employeeId
    ? await prisma.employee.findUnique({ where: { id: session.user.employeeId } })
    : null

  const comment = await prisma.taskComment.create({
    data: {
      taskId,
      senderId: session.user.id,
      senderName: employee?.name ?? session.user.name ?? session.user.email ?? "Unknown",
      senderAvatar: employee?.avatar ?? null,
      content: content?.trim() ?? "",
      audioContent: audioContent ?? null,
      attachments: attachments ?? undefined,
      mentions: mentions ?? [],
    },
  })

  if (mentions && mentions.length > 0) {
    const task = await prisma.task.findUnique({ where: { id: taskId } })
    const preview = content?.trim()
      ? content.trim().slice(0, 80)
      : audioContent
      ? "[Voice message]"
      : "[Attachment]"
    const senderName = employee?.name ?? session.user.name ?? "Someone"
    for (const userId of mentions as string[]) {
      if (userId !== session.user.id) {
        await pushNotification(userId, {
          type: "mention",
          title: `Mentioned in task: ${task?.title ?? ""}`,
          message: `${senderName}: ${preview}`,
          link: `/tasks`,
        }).catch(() => {})
      }
    }
  }

  return NextResponse.json(comment)
}
