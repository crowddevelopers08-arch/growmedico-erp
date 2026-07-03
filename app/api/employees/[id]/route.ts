import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import bcrypt from "bcryptjs"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { employeeUpdateSchema, firstIssueMessage } from "@/lib/validations"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          role: true,
        },
      },
    },
  })
  if (!employee) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const { user, ...employeeData } = employee
  return NextResponse.json({
    ...employeeData,
    accountRole: employee.user?.role ?? "EMPLOYEE",
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const parsed = employeeUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 })
    }

    const { password, accountRole, ...employeeData } = parsed.data

    // Check the Employee table and the User (login) table for conflicts,
    // excluding this employee's own records — a login account can hold an
    // email with no matching Employee row (e.g. the admin's own account).
    const [existingEmployeeEmail, existingEmployeePhone, existingUserEmail] = await Promise.all([
      prisma.employee.findFirst({ where: { email: employeeData.email, NOT: { id } } }),
      prisma.employee.findFirst({ where: { phone: employeeData.phone, NOT: { id } } }),
      prisma.user.findFirst({ where: { email: employeeData.email, employeeId: { not: id } } }),
    ])
    if (existingEmployeeEmail || existingUserEmail) {
      return NextResponse.json({ error: "An employee with this email already exists" }, { status: 409 })
    }
    if (existingEmployeePhone) {
      return NextResponse.json({ error: "An employee with this phone number already exists" }, { status: 409 })
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined

    const employee = await prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({ where: { id }, data: employeeData })

      if (password || accountRole || employeeData.email) {
        const data: { password?: string; role?: string; email?: string } = { email: updated.email }
        if (hashedPassword) data.password = hashedPassword
        if (accountRole) data.role = accountRole

        await tx.user.update({ where: { employeeId: id }, data })
      }

      return updated
    })

    return NextResponse.json({
      ...employee,
      accountRole: accountRole ?? undefined,
    })
  } catch (err: unknown) {
    console.error("[PATCH /api/employees/:id] Error:", err)
    const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code?: unknown }).code) : ""
    if (code === "P2002") {
      return NextResponse.json({ error: "An employee with this email or phone number already exists" }, { status: 409 })
    }
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 })
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
