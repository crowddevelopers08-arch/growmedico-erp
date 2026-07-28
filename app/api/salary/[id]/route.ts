import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { todayIST } from "@/lib/date"
import { getUserIdForEmployee, notify } from "@/lib/notifications"
import { periodPrefix, salaryBreakdown } from "@/lib/salary"

function toAmount(value: unknown, fallback: number) {
  const num = typeof value === "number" ? value : Number(value)
  return Number.isFinite(num) && num >= 0 ? num : fallback
}

/**
 * Deductions + net for one record from stored attendance and approved leave.
 * Same maths the bulk routes use, scoped to a single employee/period.
 */
async function computeFor(
  employeeId: string,
  month: string,
  year: number,
  amounts: { baseSalary: number; bonus: number; overtime: number },
) {
  const prefix = periodPrefix(month, year)
  if (!prefix) return { deductions: 0, net: Math.max(0, amounts.baseSalary + amounts.bonus + amounts.overtime) }
  const [attendance, leaves] = await Promise.all([
    prisma.attendance.findMany({
      where: { employeeId, date: { startsWith: prefix } },
      select: { employeeId: true, date: true, status: true },
    }),
    prisma.leaveRequest.findMany({
      where: { employeeId, status: "approved" },
      select: { employeeId: true, startDate: true, endDate: true, status: true },
    }),
  ])
  const breakdown = salaryBreakdown({ ...amounts, attendance, leaves, employeeId, month, year })
  return { deductions: breakdown.deductions, net: breakdown.net }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const { action } = body

    const existing = await prisma.salaryRecord.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Salary record not found" }, { status: 404 })

    if (action === "process") {
      const record = await prisma.salaryRecord.update({
        where: { id },
        data: { status: "processed" },
      })
      return NextResponse.json(record)
    }

    if (action === "markPaid") {
      const record = await prisma.salaryRecord.update({
        where: { id },
        data: { status: "paid", paidOn: todayIST() },
      })

      const employeeUserId = await getUserIdForEmployee(record.employeeId)
      if (employeeUserId) {
        await notify(employeeUserId, {
          type: "salary_paid",
          title: "Salary paid",
          message: `Your salary for ${record.month} ${record.year} (₹${record.netSalary.toLocaleString("en-IN")}) has been paid.`,
          link: "/my-portal",
        })
      }

      return NextResponse.json(record)
    }

    // Send a record back to pending — an escape hatch for a mistaken process/pay.
    if (action === "revert") {
      const record = await prisma.salaryRecord.update({
        where: { id },
        data: { status: "pending", paidOn: null },
      })
      return NextResponse.json(record)
    }

    // Refresh net from current attendance without touching the amounts.
    if (action === "recalculate") {
      if (existing.status === "paid") {
        return NextResponse.json({ error: "A paid salary can't be recalculated. Revert it first." }, { status: 400 })
      }
      const { deductions, net } = await computeFor(existing.employeeId, existing.month, existing.year, {
        baseSalary: existing.baseSalary,
        bonus: existing.bonus,
        overtime: existing.overtime,
      })
      const record = await prisma.salaryRecord.update({ where: { id }, data: { deductions, netSalary: net } })
      return NextResponse.json(record)
    }

    // Edit the amounts. Only the fields supplied change; net salary is always
    // recomputed from the amounts and the employee's present days, so it can
    // never drift out of step. A paid record is locked so history isn't
    // rewritten after money has gone out.
    if (action === "update" || action === undefined) {
      if (existing.status === "paid") {
        return NextResponse.json({ error: "A paid salary can't be edited. Revert it first." }, { status: 400 })
      }

      const baseSalary = toAmount(body.baseSalary, existing.baseSalary)
      const bonus = toAmount(body.bonus, existing.bonus)
      const overtime = toAmount(body.overtime, existing.overtime)
      // Deductions aren't taken from the request — they're the late penalty plus
      // unapproved-absence penalty, derived from attendance and approved leave so
      // they can't be hand-waved away.
      const { deductions, net } = await computeFor(existing.employeeId, existing.month, existing.year, { baseSalary, bonus, overtime })

      const record = await prisma.salaryRecord.update({
        where: { id },
        data: { baseSalary, bonus, overtime, deductions, netSalary: net },
      })
      return NextResponse.json(record)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (err: unknown) {
    console.error("[PATCH /api/salary/:id] Error:", err)
    const message = err instanceof Error ? err.message : "Failed to update salary record"
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
    const record = await prisma.salaryRecord.findUnique({ where: { id } })
    if (!record) return NextResponse.json({ error: "Salary record not found" }, { status: 404 })

    // A paid salary is a financial record; deleting it would erase proof of
    // payment, so block it and steer the admin to revert first if truly needed.
    if (record.status === "paid") {
      return NextResponse.json({ error: "A paid salary record can't be deleted" }, { status: 400 })
    }

    await prisma.salaryRecord.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error("[DELETE /api/salary/:id] Error:", err)
    const message = err instanceof Error ? err.message : "Failed to delete salary record"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
