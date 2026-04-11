import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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
  const canManageProjects = session?.user.role === "ADMIN" || session?.user.role === "MANAGER"
  if (!session || !canManageProjects) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!session.user.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 })
  }

  const body = await req.json()
  const { clientName, name, description, dueDate, priority, status } = body
  const memberIds = normalizeMemberIds(body.memberIds)

  if (!clientName?.trim() || !name?.trim()) {
    return NextResponse.json({ error: "Client name and project name are required" }, { status: 400 })
  }

  if (!(await validateMemberIds(memberIds))) {
    return NextResponse.json({ error: "One or more selected members are invalid" }, { status: 400 })
  }

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
        priority: priority ?? "medium",
        status: status ?? "open",
        createdById: session.user.id,
        members: memberIds.length
          ? {
              create: memberIds.map((employeeId) => ({ employeeId })),
            }
          : undefined,
      },
      include: memberInclude,
    })

    return NextResponse.json(project, { status: 201 })
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
