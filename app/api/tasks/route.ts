import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canManageDelivery } from "@/lib/permissions"
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

/** True when the employee's linked login has a MANAGER (or ADMIN) account role. */
async function isManagerEmployee(employeeId: string) {
  const user = await prisma.user.findFirst({
    where: { employeeId, role: { in: ["MANAGER", "ADMIN"] } },
    select: { id: true },
  })
  return Boolean(user)
}

/** Resolve manager Employee ids to display profiles for the task list. */
async function getManagerDirectory(managerIds: string[]) {
  const uniqueIds = Array.from(new Set(managerIds.filter((id): id is string => Boolean(id))))
  if (!uniqueIds.length) return new Map<string, { name: string; avatar: string | null; initials: string }>()

  const employees = await prisma.employee.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, name: true, avatar: true, initials: true },
  })

  const directory = new Map<string, { name: string; avatar: string | null; initials: string }>()
  employees.forEach((employee) => {
    directory.set(employee.id, { name: employee.name, avatar: employee.avatar, initials: employee.initials })
  })
  return directory
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const canManageTasks = canManageDelivery(session.user)

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
  const managerDirectory = await getManagerDirectory(
    tasks.map((task) => task.managerId).filter((id): id is string => Boolean(id))
  )

  return NextResponse.json(
    tasks.map((task) => {
      const manager = task.managerId ? managerDirectory.get(task.managerId) : null
      return {
        ...task,
        projectId: task.project?.id ?? task.projectId,
        projectName: task.project?.name ?? null,
        clientName: task.project?.clientName ?? null,
        assignedByName: task.assignedByName ?? assignerDirectory.get(task.assignedById)?.name ?? null,
        assignedByAvatar: task.assignedByAvatar ?? assignerDirectory.get(task.assignedById)?.avatar ?? null,
        managerName: manager?.name ?? null,
        managerAvatar: manager?.avatar ?? null,
        managerInitials: manager?.initials ?? null,
        stage: task.stage ?? "Unstaged Tasks",
        commentCount: task._count.comments,
        project: undefined,
        _count: undefined,
      }
    })
  )
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const canManageTasks = canManageDelivery(session.user)
  const body = await req.json()
  const parsed = taskCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 })
  }
  const { title, description, priority, dueDate, projectId, stage, estimatedHours } = parsed.data

  // Flow 1 (Admin -> Manager -> Employee): a delegated task is created by an
  // admin and routed through a manager, who later reassigns it to an employee.
  // The manager is the initial owner, so the current assignee starts as the
  // manager and `managerId` records who is accountable for the delegation.
  const managerId = parsed.data.managerId ?? null
  const isDelegated = Boolean(managerId)
  const assignedToId = isDelegated ? (managerId as string) : parsed.data.assignedToId

  if (isDelegated && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can delegate a task through a manager" }, { status: 403 })
  }

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
    return NextResponse.json(
      { error: isDelegated ? "The manager must be a project member" : "Task can only be assigned to a project member" },
      { status: 400 }
    )
  }

  if (isDelegated && !(await isManagerEmployee(assignedToId))) {
    return NextResponse.json({ error: "A task can only be delegated to a manager" }, { status: 400 })
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
      managerId,
      priority: priority ?? "medium",
      stage: stage?.trim() || project.stages[0] || "Unstaged Tasks",
      dueDate: dueDate ?? null,
      estimatedHours: estimatedHours ?? null,
      collaborators: collaboratorIds,
    },
  })

  const assignerName = assigner?.employee?.name ?? session.user.name ?? "Someone"
  const userIdByEmployeeId = await getUserIdsForEmployees([assignedToId, ...collaboratorIds])

  const assigneeUserId = userIdByEmployeeId.get(assignedToId)
  if (assigneeUserId && assigneeUserId !== session.user.id) {
    await pushNotification(assigneeUserId, isDelegated
      ? {
          type: "task_delegated",
          title: `Task to delegate: ${title}`,
          message: `${assignerName} routed a task to you in ${project.name}. Assign it to a team member.`,
          link: "/tasks",
        }
      : {
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
