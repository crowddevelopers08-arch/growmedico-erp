import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { parseDirectChannelName, isGroupDmChannelName, parseGroupDmMeta } from "@/lib/chat"

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const channel = await prisma.channel.findUnique({ where: { id } })
  if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const isAdmin = session.user.role === "ADMIN"
  const isCreator = channel.createdById === session.user.id

  if (isGroupDmChannelName(channel.name)) {
    const meta = parseGroupDmMeta(channel.description)
    if (!meta?.members.includes(session.user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: "Only the group creator or an admin can delete this group" }, { status: 403 })
    }
  } else {
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    if (parseDirectChannelName(channel.name)) {
      return NextResponse.json({ error: "Direct chats cannot be deleted here" }, { status: 400 })
    }
  }

  await prisma.channel.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const channel = await prisma.channel.findUnique({ where: { id } })
  if (!channel) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!isGroupDmChannelName(channel.name)) {
    return NextResponse.json({ error: "Only group chats can be updated this way" }, { status: 400 })
  }

  const meta = parseGroupDmMeta(channel.description)
  if (!meta || !meta.members.includes(session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { addMemberIds, removeMemberIds } = body as { addMemberIds?: string[]; removeMemberIds?: string[] }

  const isCreatorOrAdmin = channel.createdById === session.user.id || session.user.role === "ADMIN"

  let members = [...meta.members]

  if (Array.isArray(addMemberIds) && addMemberIds.length > 0) {
    const validIds = addMemberIds.filter((mid) => typeof mid === "string")
    members = Array.from(new Set([...members, ...validIds]))
  }

  if (Array.isArray(removeMemberIds) && removeMemberIds.length > 0) {
    if (!isCreatorOrAdmin) {
      return NextResponse.json({ error: "Only the group creator can remove members" }, { status: 403 })
    }
    // Creator cannot be removed
    members = members.filter((mid) => !removeMemberIds.includes(mid) || mid === channel.createdById)
  }

  const newMeta = { ...meta, members }
  await prisma.channel.update({
    where: { id },
    data: { description: JSON.stringify(newMeta) },
  })

  const users = await prisma.user.findMany({
    where: { id: { in: members } },
    select: { id: true, employee: { select: { name: true, avatar: true } } },
  })
  const userMap = new Map(users.map((u) => [u.id, u]))
  const groupMembers = members.map((userId) => {
    const u = userMap.get(userId)
    return { userId, name: u?.employee?.name ?? "Unknown", avatar: u?.employee?.avatar ?? null }
  })

  return NextResponse.json({ groupMembers })
}
