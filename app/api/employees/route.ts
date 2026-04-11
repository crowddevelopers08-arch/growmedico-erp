import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import bcrypt from "bcryptjs"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const today = new Date().toISOString().split("T")[0]

  const [employees, todayAttendance, approvedLeavesToday] = await Promise.all([
    prisma.employee.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            role: true,
          },
        },
      },
    }),
    prisma.attendance.findMany({
      where: { date: today },
      select: { employeeId: true, status: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "approved",
        startDate: { lte: today },
        endDate: { gte: today },
      },
      select: { employeeId: true },
    }),
  ])

  const attendanceByEmployee = new Map(todayAttendance.map((a) => [a.employeeId, a.status]))
  const leaveEmployeeIds = new Set(approvedLeavesToday.map((l) => l.employeeId))

  const employeesWithLiveStatus = employees.map((employee) => {
    const { user, ...employeeData } = employee
    const accountRole = employee.user?.role ?? "EMPLOYEE"

    if (leaveEmployeeIds.has(employee.id)) {
      return { ...employeeData, accountRole, status: "onLeave" as const }
    }

    const attendanceStatus = attendanceByEmployee.get(employee.id)
    if (attendanceStatus === "remote") {
      return { ...employeeData, accountRole, status: "remote" as const }
    }
    if (attendanceStatus === "present" || attendanceStatus === "late") {
      return { ...employeeData, accountRole, status: "present" as const }
    }
    if (attendanceStatus === "absent") {
      return { ...employeeData, accountRole, status: "absent" as const }
    }

    // No attendance record for today means absent for today's employee view.
    return { ...employeeData, accountRole, status: "absent" as const }
  })

  return NextResponse.json(employeesWithLiveStatus)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { password, accountRole = "EMPLOYEE", ...employeeData } = body

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
        role: accountRole,
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
