import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import bcrypt from "bcryptjs"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const employee = await prisma.employee.findUnique({ where: { id } })
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(employee)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const { password, ...employeeData } = body
    const employee = await prisma.employee.update({ where: { id }, data: employeeData })

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10)
      await prisma.user.update({
        where: { employeeId: id },
        data: { password: hashedPassword },
      })
    }

    return NextResponse.json(employee)
  } catch (err: unknown) {
    console.error("[PATCH /api/employees/:id] Error:", err)
    const message = err instanceof Error ? err.message : "Failed to update employee"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { id } = await params
    const employee = await prisma.employee.findUnique({ where: { id } })
    if (employee) {
      await prisma.activity.create({
        data: {
          type: "employee",
          action: "Employee Removed",
          description: `${employee.name} was removed from the system`,
        },
      })
    }

    await prisma.employee.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error("[DELETE /api/employees/:id] Error:", err)
    const message = err instanceof Error ? err.message : "Failed to delete employee"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
