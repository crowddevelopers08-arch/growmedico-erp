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

  const body = await req.json()
  const { addMemberIds, removeMemberIds } = body as { addMemberIds?: string[]; removeMemberIds?: string[] }

  // Group channels keep their roster on the channel row. Only an admin or the
  // channel's creator may change who is in one.
  if (!isGroupDmChannelName(channel.name) && !parseDirectChannelName(channel.name)) {
    const isAdmin = session.user.role === "ADMIN"
    if (!isAdmin && channel.createdById !== session.user.id) {
      return NextResponse.json({ error: "Only an admin or the channel creator can change members" }, { status: 403 })
    }

    let members = [...channel.memberIds]
    if (Array.isArray(addMemberIds) && addMemberIds.length > 0) {
      members = Array.from(new Set([...members, ...addMemberIds.filter((id) => typeof id === "string")]))
    }
    if (Array.isArray(removeMemberIds) && removeMemberIds.length > 0) {
      // The creator stays, so a channel can never end up with no way back in.
      members = members.filter((id) => !removeMemberIds.includes(id) || id === channel.createdById)
    }
    // An empty roster would silently reopen the channel to everyone.
    if (members.length === 0) {
      return NextResponse.json({ error: "A channel needs at least one member" }, { status: 400 })
    }

    await prisma.channel.update({ where: { id }, data: { memberIds: members } })

    const channelUsers = await prisma.user.findMany({
      where: { id: { in: members } },
      select: { id: true, email: true, employee: { select: { name: true, avatar: true } } },
    })
    const byId = new Map(channelUsers.map((user) => [user.id, user]))
    return NextResponse.json({
      memberIds: members,
      groupMembers: members.map((userId) => {
        const user = byId.get(userId)
        return {
          userId,
          name: user?.employee?.name ?? user?.email ?? "Unknown",
          avatar: user?.employee?.avatar ?? null,
        }
      }),
    })
  }

  if (!isGroupDmChannelName(channel.name)) {
    return NextResponse.json({ error: "Only group chats can be updated this way" }, { status: 400 })
  }

  const meta = parseGroupDmMeta(channel.description)
  if (!meta || !meta.members.includes(session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

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
