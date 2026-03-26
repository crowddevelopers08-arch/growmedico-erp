import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const isAdmin = session.user.role === "ADMIN"

  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 })

  // Employees can only update status of their own tasks
  if (!isAdmin && task.assignedToId !== session.user.employeeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const allowedFields = isAdmin
    ? { title: body.title, description: body.description, priority: body.priority, status: body.status, dueDate: body.dueDate, assignedToId: body.assignedToId }
    : { status: body.status }

  const updated = await prisma.task.update({
    where: { id },
    data: Object.fromEntries(Object.entries(allowedFields).filter(([, v]) => v !== undefined)),
  })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
