import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildDirectChannelName, parseDirectChannelName, isGroupDmChannelName, parseGroupDmMeta, GROUP_DM_PREFIX } from "@/lib/chat"
import { randomUUID } from "crypto"

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

  // Collect all user IDs needed: from direct channels and group_dm channels
  const directUserIds: string[] = []
  const groupDmUserIds: string[] = []

  for (const channel of channels) {
    if (isGroupDmChannelName(channel.name)) {
      const meta = parseGroupDmMeta(channel.description)
      if (meta) groupDmUserIds.push(...meta.members)
    } else {
      const directIds = parseDirectChannelName(channel.name)
      if (directIds) directUserIds.push(...directIds.filter((id) => id !== session.user.id))
    }
  }

  const allUserIds = Array.from(new Set([...directUserIds, ...groupDmUserIds]))

  const users = allUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: allUserIds } },
        select: {
          id: true,
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
        // Regular channels and direct DMs
        const directIds = parseDirectChannelName(channel.name)
        return !directIds || directIds.includes(session.user.id)
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

        return {
          id: channel.id,
          name: peer?.employee?.name ?? "Direct Message",
          description: channel.description,
          createdById: channel.createdById,
          createdAt: channel.createdAt,
          kind: "direct" as const,
          peerUserId,
          peerEmployeeId: peer?.employeeId ?? null,
          peerName: peer?.employee?.name ?? null,
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
      name: targetUser.employee?.name ?? "Direct Message",
      description: channel.description,
      createdById: channel.createdById,
      createdAt: channel.createdAt,
      kind: "direct" as const,
      peerUserId: targetUser.id,
      peerEmployeeId: targetUser.employeeId ?? null,
      peerName: targetUser.employee?.name ?? null,
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

  if (!name?.trim()) return NextResponse.json({ error: "Channel name is required" }, { status: 400 })

  try {
    const channel = await prisma.channel.create({
      data: { name: name.trim(), description: description?.trim() ?? null, createdById: session.user.id },
    })
    return NextResponse.json(channel)
  } catch {
    return NextResponse.json({ error: "Channel name already exists" }, { status: 409 })
  }
}
