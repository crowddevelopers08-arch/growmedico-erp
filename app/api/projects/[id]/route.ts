import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageDelivery } from "@/lib/permissions"
import { getUserIdsForEmployees, notifyMany } from "@/lib/notifications"

const memberInclude = {
  members: {
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          avatar: true,
          initials: true,
          role: true,
          department: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc" as const,
    },
  },
  projectStages: {
    orderBy: {
      orderIndex: "asc" as const,
    },
  },
  attributes: {
    orderBy: {
      orderIndex: "asc" as const,
    },
  },
} as const

function normalizeMemberIds(value: unknown) {
  if (!Array.isArray(value)) return []

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

async function validateMemberIds(memberIds: string[]) {
  if (!memberIds.length) return true
  const count = await prisma.employee.count({ where: { id: { in: memberIds } } })
  return count === memberIds.length
}

/** Accepts both the wizard's {name, color} objects and plain stage-name strings. */
function normalizeStages(value: unknown): Array<{ name: string; color: string }> {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const stages: Array<{ name: string; color: string }> = []

  for (const item of value) {
    const name = typeof item === "string" ? item.trim() : String((item as { name?: unknown })?.name ?? "").trim()
    if (!name || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    const color =
      typeof item === "object" && item !== null && typeof (item as { color?: unknown }).color === "string"
        ? (item as { color: string }).color
        : "#64748b"
    stages.push({ name, color })
  }

  return stages
}

interface AttributeInput {
  scope: string
  kind: string
  name: string
  color: string
  orderIndex: number
  isTerminal: boolean
}

function normalizeAttributes(value: unknown): AttributeInput[] {
  if (!Array.isArray(value)) return []

  const seen = new Set<string>()
  const rows: AttributeInput[] = []

  for (const item of value) {
    if (typeof item !== "object" || item === null) continue
    const record = item as Record<string, unknown>
    const scope = String(record.scope ?? "")
    const kind = String(record.kind ?? "")
    const name = String(record.name ?? "").trim()
    if (!name) continue
    if (scope !== "project" && scope !== "task") continue
    if (kind !== "status" && kind !== "tag" && kind !== "priority") continue

    const key = `${scope}:${kind}:${name.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)

    rows.push({
      scope,
      kind,
      name,
      color: typeof record.color === "string" ? record.color : "#64748b",
      orderIndex: rows.length,
      isTerminal: record.isTerminal === true,
    })
  }

  return rows
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  const canManageProjects = canManageDelivery(session?.user)
  if (!session || !canManageProjects) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()

  const project = await prisma.clientProject.findUnique({ where: { id } })
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  let addedMemberIds: string[] = []

  if (body.memberIds !== undefined) {
    const memberIds = normalizeMemberIds(body.memberIds)

    if (!(await validateMemberIds(memberIds))) {
      return NextResponse.json({ error: "One or more selected members are invalid" }, { status: 400 })
    }

    // Figure out which members are genuinely new so we only notify those.
    const existingMembers = await prisma.projectMember.findMany({
      where: { projectId: id },
      select: { employeeId: true },
    })
    const existingIds = new Set(existingMembers.map((m) => m.employeeId))
    addedMemberIds = memberIds.filter((memberId) => !existingIds.has(memberId))

    data.members = {
      deleteMany: {},
      create: memberIds.map((employeeId) => ({ employeeId })),
    }
  }

  let stagesToApply: Array<{ name: string; color: string }> | null = null

  if (body.stages !== undefined) {
    const stages = normalizeStages(body.stages)
    if (stages.length === 0) {
      return NextResponse.json({ error: "At least one stage is required" }, { status: 400 })
    }
    stagesToApply = stages
    // The legacy name array stays the mirror of projectStages.
    data.stages = stages.map((stage) => stage.name)
    data.projectStages = {
      deleteMany: {},
      create: stages.map((stage, index) => ({
        name: stage.name,
        color: stage.color,
        orderIndex: index,
      })),
    }
  }

  if (body.attributes !== undefined) {
    const attributes = normalizeAttributes(body.attributes)
    data.attributes = {
      deleteMany: {},
      create: attributes,
    }
  }

  // Plain scalar fields the Info tab and project settings edit.
  const scalarFields = ["description", "status", "priority", "dueDate", "startDate", "visibility"] as const
  for (const field of scalarFields) {
    if (body[field] !== undefined) {
      data[field] = typeof body[field] === "string" ? body[field].trim() || null : body[field]
    }
  }

  if (body.ownerId !== undefined) data.ownerId = body.ownerId || null
  if (body.defaultAssigneeId !== undefined) data.defaultAssigneeId = body.defaultAssigneeId || null
  if (body.tags !== undefined && Array.isArray(body.tags)) {
    data.tags = body.tags.filter((tag: unknown): tag is string => typeof tag === "string" && tag.trim().length > 0)
  }

  const updated = await prisma.clientProject.update({
    where: { id },
    data,
    include: memberInclude,
  })

  // A removed stage would leave its tasks pointing at a column that no longer
  // renders, so sweep them into the first stage rather than losing them.
  if (stagesToApply) {
    const names = stagesToApply.map((stage) => stage.name)
    await prisma.task.updateMany({
      where: { projectId: id, stage: { notIn: names } },
      data: { stage: names[0] },
    })
  }

  if (addedMemberIds.length > 0) {
    const userIdByEmployeeId = await getUserIdsForEmployees(addedMemberIds)
    await notifyMany(
      addedMemberIds
        .map((employeeId) => userIdByEmployeeId.get(employeeId))
        .filter((userId) => userId !== session.user.id),
      {
        type: "project_member",
        title: "Added to a project",
        message: `You were added to ${updated.clientName} — ${updated.name}.`,
        link: "/projects",
      },
    )
  }

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  const canManageProjects = canManageDelivery(session?.user)
  if (!session || !canManageProjects) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const project = await prisma.clientProject.findUnique({ where: { id } })

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  await prisma.clientProject.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
