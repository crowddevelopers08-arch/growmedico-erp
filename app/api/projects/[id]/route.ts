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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const memberIds = normalizeMemberIds(body.memberIds)

  if (!(await validateMemberIds(memberIds))) {
    return NextResponse.json({ error: "One or more selected members are invalid" }, { status: 400 })
  }

  const project = await prisma.clientProject.findUnique({ where: { id } })
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  const updated = await prisma.clientProject.update({
    where: { id },
    data: {
      members: {
        deleteMany: {},
        create: memberIds.map((employeeId) => ({ employeeId })),
      },
    },
    include: memberInclude,
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
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