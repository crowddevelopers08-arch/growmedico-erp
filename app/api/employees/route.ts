import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import bcrypt from "bcryptjs"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { employeeCreateSchema, firstIssueMessage } from "@/lib/validations"

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
    const parsed = employeeCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 })
    }

    const { password, accountRole, ...employeeData } = parsed.data

    // Check both the Employee table and the User (login) table — a login
    // account can exist with this email even when no Employee row does yet
    // (e.g. the admin's own account), and that would otherwise let the
    // Employee row get created before failing on the User's unique email.
    const [existingEmployeeEmail, existingEmployeePhone, existingUserEmail] = await Promise.all([
      prisma.employee.findUnique({ where: { email: employeeData.email } }),
      prisma.employee.findFirst({ where: { phone: employeeData.phone } }),
      prisma.user.findUnique({ where: { email: employeeData.email } }),
    ])
    if (existingEmployeeEmail || existingUserEmail) {
      return NextResponse.json({ error: "An employee with this email already exists" }, { status: 409 })
    }
    if (existingEmployeePhone) {
      return NextResponse.json({ error: "An employee with this phone number already exists" }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const employee = await prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({ data: employeeData })
      await tx.user.create({
        data: {
          email: created.email,
          password: hashedPassword,
          role: accountRole,
          employeeId: created.id,
        },
      })
      return created
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
    const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code?: unknown }).code) : ""
    if (code === "P2002") {
      return NextResponse.json({ error: "An employee with this email or phone number already exists" }, { status: 409 })
    }
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 })
  }
}
