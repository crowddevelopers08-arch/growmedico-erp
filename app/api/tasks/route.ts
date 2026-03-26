import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const isAdmin = session.user.role === "ADMIN"

  // Admins see all tasks; employees see only their own
  const where = isAdmin ? {} : { assignedToId: session.user.employeeId ?? "" }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { title, description, assignedToId, priority, dueDate } = body

  if (!title || !assignedToId) {
    return NextResponse.json({ error: "Title and assignedToId are required" }, { status: 400 })
  }

  const task = await prisma.task.create({
    data: {
      title,
      description: description ?? null,
      assignedToId,
      assignedById: session.user.id,
      priority: priority ?? "medium",
      dueDate: dueDate ?? null,
    },
  })
  return NextResponse.json(task)
}
