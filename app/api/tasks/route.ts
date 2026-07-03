import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserIdsForEmployees, pushNotification } from "@/lib/notifications"
import { taskCreateSchema, firstIssueMessage } from "@/lib/validations"

async function getAssignerDirectory(assignedByIds: string[]) {
  if (!assignedByIds.length) return new Map<string, { name: string | null; avatar: string | null }>()

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { id: { in: assignedByIds } },
        { employeeId: { in: assignedByIds } },
      ],
    },
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

  const directory = new Map<string, { name: string | null; avatar: string | null }>()

  users.forEach((user) => {
    const profile = {
      name: user.employee?.name ?? null,
      avatar: user.employee?.avatar ?? null,
    }

    directory.set(user.id, profile)
    if (user.employeeId) {
      directory.set(user.employeeId, profile)
    }
  })

  return directory
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

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const canManageTasks = session.user.role === "ADMIN" || session.user.role === "MANAGER"

  // Admins and managers see all tasks; employees see tasks they're assigned to or collaborating on
  const where = canManageTasks
    ? {}
    : {
        OR: [
          { assignedToId: session.user.employeeId ?? "" },
          { collaborators: { has: session.user.employeeId ?? "" } },
        ],
      }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      project: {
        select: {
          id: true,
          name: true,
          clientName: true,
        },
      },
      _count: {
        select: { comments: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const assignerDirectory = await getAssignerDirectory(tasks.map((task) => task.assignedById))

  return NextResponse.json(
    tasks.map((task) => ({
      ...task,
      projectId: task.project?.id ?? task.projectId,
      projectName: task.project?.name ?? null,
      clientName: task.project?.clientName ?? null,
      assignedByName: task.assignedByName ?? assignerDirectory.get(task.assignedById)?.name ?? null,
      assignedByAvatar: task.assignedByAvatar ?? assignerDirectory.get(task.assignedById)?.avatar ?? null,
      stage: task.stage ?? "Unstaged Tasks",
      commentCount: task._count.comments,
      project: undefined,
      _count: undefined,
    }))
  )
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const canManageTasks = session.user.role === "ADMIN" || session.user.role === "MANAGER"
  const body = await req.json()
  const parsed = taskCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 })
  }
  const { title, description, assignedToId, priority, dueDate, projectId, stage } = parsed.data

  // Anyone can create a self task (assigned only to themselves); assigning
  // to someone else, or adding collaborators, still requires ADMIN/MANAGER.
  const isSelfAssignment = Boolean(session.user.employeeId) && assignedToId === session.user.employeeId
  if (!canManageTasks && !isSelfAssignment) {
    return NextResponse.json({ error: "You can only create tasks assigned to yourself" }, { status: 403 })
  }

  const collaboratorIds = canManageTasks
    ? normalizeEmployeeIds(body.collaborators).filter((id) => id !== assignedToId)
    : []

  const project = await prisma.clientProject.findUnique({
    where: { id: projectId },
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

  if (!(await isProjectMember(projectId, assignedToId))) {
    return NextResponse.json({ error: "Task can only be assigned to a project member" }, { status: 400 })
  }

  const memberIds = new Set(project.members.map((member) => member.employeeId))
  if (!collaboratorIds.every((id) => memberIds.has(id))) {
    return NextResponse.json({ error: "Collaborators must be project members" }, { status: 400 })
  }

  const assigner = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      employee: {
        select: {
          name: true,
          avatar: true,
        },
      },
    },
  })

  const task = await prisma.task.create({
    data: {
      title,
      description: description ?? null,
      projectId,
      assignedToId,
      assignedById: session.user.id,
      assignedByName: assigner?.employee?.name ?? session.user.name ?? null,
      assignedByAvatar: assigner?.employee?.avatar ?? session.user.image ?? null,
      priority: priority ?? "medium",
      stage: stage?.trim() || project.stages[0] || "Unstaged Tasks",
      dueDate: dueDate ?? null,
      collaborators: collaboratorIds,
    },
  })

  const assignerName = assigner?.employee?.name ?? session.user.name ?? "Someone"
  const userIdByEmployeeId = await getUserIdsForEmployees([assignedToId, ...collaboratorIds])

  const assigneeUserId = userIdByEmployeeId.get(assignedToId)
  if (assigneeUserId && assigneeUserId !== session.user.id) {
    await pushNotification(assigneeUserId, {
      type: "task_assigned",
      title: `New task assigned: ${title}`,
      message: `${assignerName} assigned you a task in ${project.name}.`,
      link: "/tasks",
    }).catch(() => {})
  }

  for (const collaboratorId of collaboratorIds) {
    const userId = userIdByEmployeeId.get(collaboratorId)
    if (userId && userId !== session.user.id) {
      await pushNotification(userId, {
        type: "task_collaborator",
        title: `Added as collaborator: ${title}`,
        message: `${assignerName} added you as a collaborator in ${project.name}.`,
        link: "/tasks?list=collaborator",
      }).catch(() => {})
    }
  }

  return NextResponse.json(task)
}
