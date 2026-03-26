import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { commentId } = await params
  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 })

  const comment = await prisma.taskComment.findUnique({ where: { id: commentId } })
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (comment.senderId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const updated = await prisma.taskComment.update({
    where: { id: commentId },
    data: { content: content.trim(), editedAt: new Date() },
  })
  return NextResponse.json(updated)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { commentId } = await params
  const comment = await prisma.taskComment.findUnique({ where: { id: commentId } })
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (comment.senderId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.taskComment.delete({ where: { id: commentId } })
  return NextResponse.json({ success: true })
}
