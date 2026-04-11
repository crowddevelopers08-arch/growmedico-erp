import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function isProjectMember(projectId: string, employeeId: string) {
  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_employeeId: {
        projectId,
        employeeId,
      },
    },
  })

  return Boolean(membership)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const canManageTasks = session.user.role === "ADMIN" || session.user.role === "MANAGER"

  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })

  // Employees can only update status of their own tasks
  if (!canManageTasks && task.assignedToId !== session.user.employeeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (canManageTasks && (body.projectId !== undefined || body.assignedToId !== undefined)) {
    const nextProjectId = body.projectId ?? task.projectId
    const nextAssignedToId = body.assignedToId ?? task.assignedToId

    if (!nextProjectId) {
      return NextResponse.json({ error: "Project is required for task assignment" }, { status: 400 })
    }

    const project = await prisma.clientProject.findUnique({
      where: { id: nextProjectId },
      include: {
        members: {
          select: {
            employeeId: true,
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    if (project.members.length === 0) {
      return NextResponse.json({ error: "Add project members before assigning tasks" }, { status: 400 })
    }

    if (!(await isProjectMember(nextProjectId, nextAssignedToId))) {
      return NextResponse.json({ error: "Task can only be assigned to a project member" }, { status: 400 })
    }
  }

  const allowedFields = canManageTasks
    ? {
        title: body.title,
        description: body.description,
        priority: body.priority,
        status: body.status,
        stage: body.stage,
        dueDate: body.dueDate,
        assignedToId: body.assignedToId,
        projectId: body.projectId,
      }
    : { status: body.status }

  const updated = await prisma.task.update({
    where: { id },
    data: Object.fromEntries(Object.entries(allowedFields).filter(([, v]) => v !== undefined)),
  })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  const canManageTasks = session?.user.role === "ADMIN" || session?.user.role === "MANAGER"
  if (!session || !canManageTasks) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
