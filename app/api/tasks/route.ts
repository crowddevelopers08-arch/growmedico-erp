import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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

  // Admins and managers see all tasks; employees see only their own
  const where = canManageTasks ? {} : { assignedToId: session.user.employeeId ?? "" }

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
      project: undefined,
    }))
  )
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const canManageTasks = session?.user.role === "ADMIN" || session?.user.role === "MANAGER"
  if (!session || !canManageTasks) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { title, description, assignedToId, priority, dueDate, projectId, stage } = body

  if (!title || !assignedToId || !projectId) {
    return NextResponse.json({ error: "Title, assigned employee, and project are required" }, { status: 400 })
  }

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
      stage: stage?.trim() || "Unstaged Tasks",
      dueDate: dueDate ?? null,
    },
  })
  return NextResponse.json(task)
}
