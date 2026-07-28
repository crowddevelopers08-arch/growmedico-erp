import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageDelivery } from "@/lib/permissions"
import { templateCreateSchema, firstIssueMessage } from "@/lib/validations"

/**
 * Gallery listing. Returns each template with its stages and attributes (cheap,
 * and the preview needs them anyway) plus a task count for the card.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const templates = await prisma.projectTemplate.findMany({
    include: {
      stages: { orderBy: { orderIndex: "asc" } },
      attributes: { orderBy: { orderIndex: "asc" } },
      _count: { select: { tasks: true } },
    },
    orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }],
  })

  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !canManageDelivery(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const parsed = templateCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 })
  }

  const { name, description, category, tag, coverImage, stages, attributes, tasks } = parsed.data

  const existing = await prisma.projectTemplate.findUnique({ where: { name: name.trim() } })
  if (existing) {
    return NextResponse.json({ error: "A template with this name already exists" }, { status: 409 })
  }

  const template = await prisma.projectTemplate.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      category: category?.trim() || "General",
      tag: tag?.trim() || null,
      coverImage: coverImage?.trim() || null,
      isBuiltIn: false,
      createdById: session.user.id,
      stages: stages?.length
        ? {
            create: stages.map((stage, index) => ({
              name: stage.name,
              color: stage.color ?? "#64748b",
              orderIndex: index,
            })),
          }
        : undefined,
      attributes: attributes?.length
        ? {
            create: attributes.map((attribute, index) => ({
              scope: attribute.scope,
              kind: attribute.kind,
              name: attribute.name,
              color: attribute.color ?? "#64748b",
              orderIndex: index,
              isTerminal: attribute.isTerminal ?? false,
            })),
          }
        : undefined,
      tasks: tasks?.length
        ? {
            create: tasks.map((task, index) => ({
              title: task.title,
              description: task.description?.trim() || null,
              priority: task.priority ?? "medium",
              stageName: task.stageName?.trim() || null,
              statusName: task.statusName?.trim() || null,
              estimatedHours: task.estimatedHours ?? null,
              orderIndex: index,
            })),
          }
        : undefined,
    },
    include: {
      stages: { orderBy: { orderIndex: "asc" } },
      attributes: { orderBy: { orderIndex: "asc" } },
      tasks: { orderBy: { orderIndex: "asc" } },
    },
  })

  return NextResponse.json(template, { status: 201 })
}
