import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageDelivery } from "@/lib/permissions"
import { projectWizardSchema, firstIssueMessage } from "@/lib/validations"
import { defaultAttributeRows, FALLBACK_STAGE } from "@/lib/project-defaults"

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

function isSameProjectName(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: "accent" }) === 0
}

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

/**
 * Stages arrive from the wizard as {name, color} objects but older clients still
 * post plain strings. Both are accepted; duplicates are dropped because stage
 * names are the key tasks reference.
 */
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

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const projects = await prisma.clientProject.findMany({
    include: {
      _count: {
        select: {
          tasks: true,
        },
      },
      ...memberInclude,
    },
    orderBy: [{ clientName: "asc" }, { name: "asc" }],
  })

  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const canManageProjects = canManageDelivery(session?.user)
  if (!session || !canManageProjects) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!session.user.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = projectWizardSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 })
  }

  const {
    clientName,
    name,
    description,
    dueDate,
    startDate,
    priority,
    status,
    visibility,
    ownerId,
    defaultAssigneeId,
    tags,
    attributes,
    templateId,
  } = parsed.data
  const memberIds = normalizeMemberIds(body.memberIds)
  const stages = normalizeStages(parsed.data.stages ?? body.stages)

  if (!(await validateMemberIds(memberIds))) {
    return NextResponse.json({ error: "One or more selected members are invalid" }, { status: 400 })
  }

  // Owner and default assignee are employees and must exist. They do not have to
  // be members — a lead can own a project they aren't staffed on.
  const referencedEmployeeIds = [ownerId, defaultAssigneeId].filter((value): value is string => Boolean(value))
  if (referencedEmployeeIds.length && !(await validateMemberIds(referencedEmployeeIds))) {
    return NextResponse.json({ error: "Selected owner or default assignee is invalid" }, { status: 400 })
  }

  // Template is resolved before the project exists so a bad id fails fast rather
  // than leaving a project with no starter tasks.
  const template = templateId
    ? await prisma.projectTemplate.findUnique({
        where: { id: templateId },
        include: { tasks: { orderBy: { orderIndex: "asc" } } },
      })
    : null

  if (templateId && !template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }

  // Wizard-defined option sets, falling back to the app defaults so every
  // project always has a usable status/priority list.
  const attributeRows = (attributes?.length ? attributes : defaultAttributeRows()).map((row, index) => ({
    scope: row.scope,
    kind: row.kind,
    name: row.name.trim(),
    color: row.color ?? "#64748b",
    orderIndex: "orderIndex" in row && typeof row.orderIndex === "number" ? row.orderIndex : index,
    isTerminal: row.isTerminal ?? false,
  }))

  const stageRows = stages.length ? stages : [{ name: FALLBACK_STAGE, color: "#64748b" }]

  const normalizedClientName = clientName.trim()
  const normalizedProjectName = name.trim()

  try {
    const existingProjects = await prisma.clientProject.findMany({
      where: {
        OR: [
          { clientName: normalizedClientName },
          { name: normalizedProjectName },
        ],
      },
      include: memberInclude,
    })

    const existing = existingProjects.find((project) =>
      isSameProjectName(project.clientName, normalizedClientName) &&
      isSameProjectName(project.name, normalizedProjectName)
    )

    if (existing) return NextResponse.json(existing, { status: 200 })

    const project = await prisma.clientProject.create({
      data: {
        clientName: normalizedClientName,
        name: normalizedProjectName,
        description: description?.trim() || null,
        dueDate: dueDate?.trim() || null,
        startDate: startDate?.trim() || null,
        priority: priority ?? "medium",
        status: status ?? "open",
        visibility: visibility ?? "public",
        ownerId: ownerId || null,
        defaultAssigneeId: defaultAssigneeId || null,
        tags: tags?.length ? tags : undefined,
        createdById: session.user.id,
        // Legacy name array, kept in step with projectStages.
        stages: stageRows.map((stage) => stage.name),
        projectStages: {
          create: stageRows.map((stage, index) => ({
            name: stage.name,
            color: stage.color,
            orderIndex: index,
          })),
        },
        attributes: {
          create: attributeRows,
        },
        members: memberIds.length
          ? {
              create: memberIds.map((employeeId) => ({ employeeId })),
            }
          : undefined,
      },
      include: memberInclude,
    })

    // Clone the template's starter tasks. Stage and status names are mapped onto
    // what the project actually ended up with, since the wizard lets the user
    // rename or remove any of them before submitting.
    if (template?.tasks.length) {
      const stageNames = new Set(stageRows.map((stage) => stage.name))
      const statusNames = new Set(
        attributeRows.filter((row) => row.scope === "task" && row.kind === "status").map((row) => row.name)
      )
      const fallbackStage = stageRows[0]?.name ?? FALLBACK_STAGE
      const fallbackStatus =
        attributeRows.find((row) => row.scope === "task" && row.kind === "status")?.name ?? "pending"

      // Template tasks carry no assignee, so they need one to satisfy the schema.
      // The project's default assignee is the intent; the first member and then
      // the creator's own employee record are the fallbacks.
      const assigneeId = defaultAssigneeId || memberIds[0] || session.user.employeeId
      if (assigneeId) {
        await prisma.task.createMany({
          data: template.tasks.map((task, index) => ({
            title: task.title,
            description: task.description,
            projectId: project.id,
            assignedToId: assigneeId,
            assignedById: session.user.id,
            assignedByName: session.user.name ?? null,
            priority: task.priority,
            status: task.statusName && statusNames.has(task.statusName) ? task.statusName : fallbackStatus,
            stage: task.stageName && stageNames.has(task.stageName) ? task.stageName : fallbackStage,
            estimatedHours: task.estimatedHours,
            orderIndex: index,
          })),
        })
      }
    }

    const created = await prisma.clientProject.findUnique({
      where: { id: project.id },
      include: { _count: { select: { tasks: true } }, ...memberInclude },
    })

    return NextResponse.json(created ?? project, { status: 201 })
  } catch (err: unknown) {
    console.error("[Projects][POST] Failed to create project", err)

    const code = typeof err === "object" && err !== null && "code" in err
      ? String((err as { code?: unknown }).code)
      : ""

    if (code === "P2002") {
      const raceProjects = await prisma.clientProject.findMany({
        where: {
          OR: [
            { clientName: normalizedClientName },
            { name: normalizedProjectName },
          ],
        },
        include: memberInclude,
      })
      const raceExisting = raceProjects.find((project) =>
        isSameProjectName(project.clientName, normalizedClientName) &&
        isSameProjectName(project.name, normalizedProjectName)
      )

      if (raceExisting) return NextResponse.json(raceExisting, { status: 200 })
      return NextResponse.json({ error: "A project with this client and name already exists" }, { status: 409 })
    }

    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
}
