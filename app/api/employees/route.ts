import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import bcrypt from "bcryptjs"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const employees = await prisma.employee.findMany({
    orderBy: { createdAt: "asc" },
  })
  return NextResponse.json(employees)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { password, ...employeeData } = body

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 })
    }

    // Check if email already exists
    const existing = await prisma.employee.findUnique({ where: { email: employeeData.email } })
    if (existing) {
      return NextResponse.json({ error: "An employee with this email already exists" }, { status: 409 })
    }

    const employee = await prisma.employee.create({ data: employeeData })

    const hashedPassword = await bcrypt.hash(password, 10)
    await prisma.user.create({
      data: {
        email: employee.email,
        password: hashedPassword,
        role: "EMPLOYEE",
        employeeId: employee.id,
      },
    })

    await prisma.activity.create({
      data: {
        type: "employee",
        action: "New Employee",
        description: `${employee.name} joined the ${employee.department} team`,
        employeeId: employee.id,
      },
    })

    return NextResponse.json(employee, { status: 201 })
  } catch (err: unknown) {
    console.error("[POST /api/employees] Error:", err)
    const message = err instanceof Error ? err.message : "Failed to create employee"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
