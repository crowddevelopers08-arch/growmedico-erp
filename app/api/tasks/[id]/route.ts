import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserIdsForEmployees, pushNotification } from "@/lib/notifications"
import { taskUpdateSchema, firstIssueMessage } from "@/lib/validations"

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

function normalizeEmployeeIds(value: unknown) {
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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsedUpdate = taskUpdateSchema.safeParse(body)
  if (!parsedUpdate.success) {
    return NextResponse.json({ error: firstIssueMessage(parsedUpdate.error) }, { status: 400 })
  }
  const canManageTasks = session.user.role === "ADMIN" || session.user.role === "MANAGER"

  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })

  // Employees can only update status of their own tasks, unless it's a self
  // task they created for themselves, in which case they own the full record.
  const isOwnSelfTask = task.assignedById === session.user.id && task.assignedToId === session.user.employeeId
  if (!canManageTasks && task.assignedToId !== session.user.employeeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  let collaboratorIds: string[] | undefined
  let notifyProjectName: string | undefined
  let newlyAssignedEmployeeId: string | null = null
  let newlyAddedCollaboratorIds: string[] = []

  if (canManageTasks && (body.projectId !== undefined || body.assignedToId !== undefined || body.collaborators !== undefined)) {
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

    notifyProjectName = project.name
    if (body.assignedToId !== undefined && body.assignedToId !== task.assignedToId) {
      newlyAssignedEmployeeId = body.assignedToId
    }

    if (body.collaborators !== undefined) {
      const memberIds = new Set(project.members.map((member) => member.employeeId))
      collaboratorIds = normalizeEmployeeIds(body.collaborators).filter((employeeId) => employeeId !== nextAssignedToId)

      if (!collaboratorIds.every((employeeId) => memberIds.has(employeeId))) {
        return NextResponse.json({ error: "Collaborators must be project members" }, { status: 400 })
      }

      const previousCollaborators = new Set(task.collaborators)
      newlyAddedCollaboratorIds = collaboratorIds.filter((employeeId) => !previousCollaborators.has(employeeId))
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
        collaborators: collaboratorIds,
      }
    : isOwnSelfTask
    ? {
        title: body.title,
        description: body.description,
        priority: body.priority,
        status: body.status,
        dueDate: body.dueDate,
      }
    : { status: body.status }

  const updated = await prisma.task.update({
    where: { id },
    data: Object.fromEntries(Object.entries(allowedFields).filter(([, v]) => v !== undefined)),
  })

  if (newlyAssignedEmployeeId || newlyAddedCollaboratorIds.length > 0) {
    const assigner = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { employee: { select: { name: true } } },
    })
    const assignerName = assigner?.employee?.name ?? session.user.name ?? "Someone"
    const projectSuffix = notifyProjectName ? ` in ${notifyProjectName}` : ""
    const userIdByEmployeeId = await getUserIdsForEmployees(
      [newlyAssignedEmployeeId, ...newlyAddedCollaboratorIds].filter((id): id is string => Boolean(id))
    )

    if (newlyAssignedEmployeeId) {
      const userId = userIdByEmployeeId.get(newlyAssignedEmployeeId)
      if (userId && userId !== session.user.id) {
        await pushNotification(userId, {
          type: "task_assigned",
          title: `New task assigned: ${updated.title}`,
          message: `${assignerName} assigned you a task${projectSuffix}.`,
          link: "/tasks",
        }).catch(() => {})
      }
    }

    for (const collaboratorId of newlyAddedCollaboratorIds) {
      const userId = userIdByEmployeeId.get(collaboratorId)
      if (userId && userId !== session.user.id) {
        await pushNotification(userId, {
          type: "task_collaborator",
          title: `Added as collaborator: ${updated.title}`,
          message: `${assignerName} added you as a collaborator${projectSuffix}.`,
          link: "/tasks?list=collaborator",
        }).catch(() => {})
      }
    }
  }

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const canManageTasks = session.user.role === "ADMIN" || session.user.role === "MANAGER"
  const { id } = await params

  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })

  const isOwnSelfTask = task.assignedById === session.user.id && task.assignedToId === session.user.employeeId
  if (!canManageTasks && !isOwnSelfTask) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
