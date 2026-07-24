import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildDirectChannelName, parseDirectChannelName, isGroupDmChannelName, parseGroupDmMeta, canAccessChannel, GROUP_DM_PREFIX } from "@/lib/chat"
import { randomUUID } from "crypto"
import { channelCreateSchema, firstIssueMessage } from "@/lib/validations"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const channels = await prisma.channel.findMany({
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "asc" },
  })

  // Collect all user IDs needed: direct peers, group DM members and the
  // members of restricted group channels.
  const directUserIds: string[] = []
  const groupDmUserIds: string[] = []
  const channelMemberIds: string[] = []

  for (const channel of channels) {
    if (isGroupDmChannelName(channel.name)) {
      const meta = parseGroupDmMeta(channel.description)
      if (meta) groupDmUserIds.push(...meta.members)
    } else {
      const directIds = parseDirectChannelName(channel.name)
      if (directIds) directUserIds.push(...directIds.filter((id) => id !== session.user.id))
      else channelMemberIds.push(...channel.memberIds)
    }
  }

  const allUserIds = Array.from(new Set([...directUserIds, ...groupDmUserIds, ...channelMemberIds]))

  const users = allUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: allUserIds } },
        select: {
          id: true,
          email: true,
          employeeId: true,
          employee: {
            select: {
              name: true,
              avatar: true,
            },
          },
        },
      })
    : []

  const userDirectory = new Map(users.map((user) => [user.id, user]))

  return NextResponse.json(
    channels
      .filter((channel) => {
        // Group DMs: only include if current user is a member
        if (isGroupDmChannelName(channel.name)) {
          const meta = parseGroupDmMeta(channel.description)
          return meta !== null && meta.members.includes(session.user.id)
        }
        // Direct DMs: only the two people in the name.
        const directIds = parseDirectChannelName(channel.name)
        if (directIds) return directIds.includes(session.user.id)
        // Group channels: members only, unless the channel is open.
        return canAccessChannel(channel.memberIds, session.user.id)
      })
      .map((channel) => {
        const latestMessage = channel.messages[0]

        // Group DM channel
        if (isGroupDmChannelName(channel.name)) {
          const meta = parseGroupDmMeta(channel.description)
          if (!meta) return null

          const groupMembers = meta.members.map((userId) => {
            const user = userDirectory.get(userId)
            return {
              userId,
              name: user?.employee?.name ?? "Unknown",
              avatar: user?.employee?.avatar ?? null,
            }
          })

          return {
            id: channel.id,
            name: meta.title,
            description: null,
            createdById: channel.createdById,
            createdAt: channel.createdAt,
            kind: "group_dm" as const,
            groupTitle: meta.title,
            groupMembers,
            unreadCount:
              latestMessage &&
              latestMessage.senderId !== session.user.id &&
              !(latestMessage.readBy ?? []).includes(session.user.id)
                ? 1
                : 0,
            lastMessageAt: latestMessage?.createdAt ?? null,
            lastMessagePreview:
              latestMessage?.content ||
              (latestMessage?.audioContent
                ? "[Voice message]"
                : latestMessage?.attachments
                  ? "[Attachment]"
                  : null),
          }
        }

        const directIds = parseDirectChannelName(channel.name)

        if (!directIds) {
          return {
            id: channel.id,
            name: channel.name,
            description: channel.description,
            createdById: channel.createdById,
            createdAt: channel.createdAt,
            kind: "group" as const,
            memberIds: channel.memberIds,
            groupMembers: channel.memberIds.map((userId) => {
              const user = userDirectory.get(userId)
              return {
                userId,
                name: user?.employee?.name ?? user?.email ?? "Unknown",
                avatar: user?.employee?.avatar ?? null,
              }
            }),
            unreadCount:
              latestMessage &&
              latestMessage.senderId !== session.user.id &&
              !(latestMessage.readBy ?? []).includes(session.user.id)
                ? 1
                : 0,
            lastMessageAt: latestMessage?.createdAt ?? null,
            lastMessagePreview:
              latestMessage?.content ||
              (latestMessage?.audioContent
                ? "[Voice message]"
                : latestMessage?.attachments
                  ? "[Attachment]"
                  : null),
          }
        }

        const peerUserId = directIds.find((userId) => userId !== session.user.id) ?? null
        const peer = peerUserId ? userDirectory.get(peerUserId) : null

        const peerDisplayName = peer?.employee?.name ?? peer?.email ?? "Direct Message"
        return {
          id: channel.id,
          name: peerDisplayName,
          description: channel.description,
          createdById: channel.createdById,
          createdAt: channel.createdAt,
          kind: "direct" as const,
          peerUserId,
          peerEmployeeId: peer?.employeeId ?? null,
          peerName: peerDisplayName,
          peerAvatar: peer?.employee?.avatar ?? null,
          unreadCount:
            latestMessage &&
            latestMessage.senderId !== session.user.id &&
            !(latestMessage.readBy ?? []).includes(session.user.id)
              ? 1
              : 0,
          lastMessageAt: latestMessage?.createdAt ?? null,
          lastMessagePreview:
            latestMessage?.content ||
            (latestMessage?.audioContent
              ? "[Voice message]"
              : latestMessage?.attachments
                ? "[Attachment]"
                : null),
        }
      })
      .filter(Boolean)
  )
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { type = "group", name, description, targetUserId, groupName, memberIds } = body

  if (type === "direct") {
    if (!targetUserId || typeof targetUserId !== "string" || targetUserId === session.user.id) {
      return NextResponse.json({ error: "A valid target user is required" }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        employeeId: true,
        employee: {
          select: {
            name: true,
            avatar: true,
          },
        },
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const targetDisplayName = targetUser.employee?.name ?? targetUser.email

    const directName = buildDirectChannelName([session.user.id, targetUserId])
    const existing = await prisma.channel.findUnique({ where: { name: directName } })
    const channel =
      existing ??
      (await prisma.channel.create({
        data: {
          name: directName,
          description: "Direct message",
          createdById: session.user.id,
        },
      }))

    return NextResponse.json({
      id: channel.id,
      name: targetDisplayName,
      description: channel.description,
      createdById: channel.createdById,
      createdAt: channel.createdAt,
      kind: "direct" as const,
      peerUserId: targetUser.id,
      peerEmployeeId: targetUser.employeeId ?? null,
      peerName: targetDisplayName,
      peerAvatar: targetUser.employee?.avatar ?? null,
      unreadCount: 0,
      lastMessageAt: null,
      lastMessagePreview: null,
    })
  }

  if (type === "group_dm") {
    if (!groupName?.trim()) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 })
    }
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json({ error: "At least one member is required" }, { status: 400 })
    }

    const allMemberIds = Array.from(new Set([session.user.id, ...memberIds.filter((id: unknown) => typeof id === "string")]))
    const channelName = `${GROUP_DM_PREFIX}${randomUUID()}`
    const meta = { gdm: true, title: groupName.trim(), members: allMemberIds }

    const channel = await prisma.channel.create({
      data: {
        name: channelName,
        description: JSON.stringify(meta),
        createdById: session.user.id,
      },
    })

    // Fetch member details for response
    const users = await prisma.user.findMany({
      where: { id: { in: allMemberIds } },
      select: {
        id: true,
        employee: { select: { name: true, avatar: true } },
      },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))
    const groupMembers = allMemberIds.map((userId) => {
      const u = userMap.get(userId)
      return { userId, name: u?.employee?.name ?? "Unknown", avatar: u?.employee?.avatar ?? null }
    })

    return NextResponse.json({
      id: channel.id,
      name: groupName.trim(),
      description: null,
      createdById: channel.createdById,
      createdAt: channel.createdAt,
      kind: "group_dm" as const,
      groupTitle: groupName.trim(),
      groupMembers,
      unreadCount: 0,
      lastMessageAt: null,
      lastMessagePreview: null,
    })
  }

  const role = session.user.role
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Only admins and managers can create channels" }, { status: 403 })
  }

  const parsed = channelCreateSchema.safeParse({ name, description, memberIds })
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 })
  }

  // The creator is always in their own channel, and only real accounts count.
  const requestedIds = Array.from(new Set([session.user.id, ...parsed.data.memberIds]))
  const validMembers = await prisma.user.findMany({
    where: { id: { in: requestedIds } },
    select: { id: true, email: true, employee: { select: { name: true, avatar: true } } },
  })
  if (validMembers.length < 2) {
    return NextResponse.json({ error: "Select at least one member" }, { status: 400 })
  }

  try {
    const channel = await prisma.channel.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
        createdById: session.user.id,
        memberIds: validMembers.map((user) => user.id),
      },
    })
    return NextResponse.json({
      ...channel,
      kind: "group" as const,
      groupMembers: validMembers.map((user) => ({
        userId: user.id,
        name: user.employee?.name ?? user.email,
        avatar: user.employee?.avatar ?? null,
      })),
    })
  } catch {
    return NextResponse.json({ error: "Channel name already exists" }, { status: 409 })
  }
}
