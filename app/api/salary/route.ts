import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { MONTH_NAMES, periodPrefix, salaryBreakdown } from "@/lib/salary"

const MONTHS = MONTH_NAMES as readonly string[]

function toAmount(value: unknown, fallback = 0) {
  const num = typeof value === "number" ? value : Number(value)
  return Number.isFinite(num) && num >= 0 ? num : fallback
}

/** Attendance rows for a period, in the minimal shape the salary maths needs. */
async function attendanceForPeriod(month: string, year: number) {
  const prefix = periodPrefix(month, year)
  if (!prefix) return []
  return prisma.attendance.findMany({
    where: { date: { startsWith: prefix } },
    select: { employeeId: true, date: true, status: true },
  })
}

/**
 * Approved leave requests overlapping a period. A request that starts before the
 * month or ends after it still counts for the days that fall inside, so the
 * filter is deliberately loose and the per-day intersection happens in the maths.
 */
async function approvedLeavesForPeriod(month: string, year: number) {
  const prefix = periodPrefix(month, year)
  if (!prefix) return []
  return prisma.leaveRequest.findMany({
    where: { status: "approved" },
    select: { employeeId: true, startDate: true, endDate: true, status: true },
  })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get("employeeId")

  const records = await prisma.salaryRecord.findMany({
    where: employeeId ? { employeeId } : undefined,
    orderBy: [{ year: "desc" }, { month: "asc" }],
  })
  return NextResponse.json(records)
}

/**
 * Two ways to create records, both admin-only:
 *  - { action: "generate", month, year } bulk-creates a pending record for every
 *    employee who doesn't yet have one that period. Base is their monthly salary
 *    (annual / 12); net is attendance-based (per-day × present days). Existing
 *    records are left untouched.
 *  - { action: "recalculate", month, year } refreshes net on every non-paid
 *    record in the period from current attendance, keeping their amounts.
 *  - a single { employeeId, month, year, ... } upserts one record, computing net
 *    from the amounts supplied and the employee's present days.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 })

  try {
    if (body.action === "generate") {
      const month = String(body.month ?? "")
      const year = Number(body.year)

      if (!MONTHS.includes(month) || !Number.isInteger(year)) {
        return NextResponse.json({ error: "A valid month and year are required" }, { status: 400 })
      }

      const employees = await prisma.employee.findMany({ select: { id: true, salary: true } })
      const existing = await prisma.salaryRecord.findMany({
        where: { month, year },
        select: { employeeId: true },
      })
      const alreadyHas = new Set(existing.map((record) => record.employeeId))
      const attendance = await attendanceForPeriod(month, year)
      const leaves = await approvedLeavesForPeriod(month, year)

      const toCreate = employees
        .filter((employee) => !alreadyHas.has(employee.id))
        .map((employee) => {
          // Base is the monthly salary (annual / 12). Net and deductions come
          // from attendance + approved leave (see salaryBreakdown).
          const baseSalary = Math.round((employee.salary ?? 0) / 12)
          const breakdown = salaryBreakdown({ baseSalary, bonus: 0, overtime: 0, attendance, leaves, employeeId: employee.id, month, year })
          return {
            employeeId: employee.id,
            month,
            year,
            baseSalary,
            bonus: 0,
            overtime: 0,
            deductions: breakdown.deductions,
            netSalary: breakdown.net,
            status: "pending",
          }
        })

      if (toCreate.length > 0) {
        await prisma.salaryRecord.createMany({ data: toCreate, skipDuplicates: true })
      }

      return NextResponse.json({ created: toCreate.length, skipped: alreadyHas.size }, { status: 201 })
    }

    if (body.action === "recalculate") {
      const month = String(body.month ?? "")
      const year = Number(body.year)

      if (!MONTHS.includes(month) || !Number.isInteger(year)) {
        return NextResponse.json({ error: "A valid month and year are required" }, { status: 400 })
      }

      // Paid records are locked, so only pending/processed nets are refreshed.
      const records = await prisma.salaryRecord.findMany({
        where: { month, year, status: { not: "paid" } },
      })
      const attendance = await attendanceForPeriod(month, year)
      const leaves = await approvedLeavesForPeriod(month, year)

      let updated = 0
      for (const record of records) {
        const breakdown = salaryBreakdown({
          baseSalary: record.baseSalary,
          bonus: record.bonus,
          overtime: record.overtime,
          attendance,
          leaves,
          employeeId: record.employeeId,
          month,
          year,
        })
        if (breakdown.net !== record.netSalary || breakdown.deductions !== record.deductions) {
          await prisma.salaryRecord.update({
            where: { id: record.id },
            data: { deductions: breakdown.deductions, netSalary: breakdown.net },
          })
          updated += 1
        }
      }

      return NextResponse.json({ updated, total: records.length })
    }

    // Single upsert.
    const employeeId = String(body.employeeId ?? "")
    const month = String(body.month ?? "")
    const year = Number(body.year)

    if (!employeeId || !MONTHS.includes(month) || !Number.isInteger(year)) {
      return NextResponse.json({ error: "Employee, month and year are required" }, { status: 400 })
    }

    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, salary: true } })
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 })

    const baseSalary = toAmount(body.baseSalary, Math.round((employee.salary ?? 0) / 12))
    const bonus = toAmount(body.bonus)
    const overtime = toAmount(body.overtime)
    const attendance = await attendanceForPeriod(month, year)
    const leaves = await approvedLeavesForPeriod(month, year)
    // Deductions (late penalty + unapproved absences) and net come from the
    // shared breakdown so this matches generate/recalculate exactly.
    const breakdown = salaryBreakdown({ baseSalary, bonus, overtime, attendance, leaves, employeeId, month, year })
    const deductions = breakdown.deductions
    const netSalary = breakdown.net

    const record = await prisma.salaryRecord.upsert({
      where: { employeeId_month_year: { employeeId, month, year } },
      update: { baseSalary, bonus, overtime, deductions, netSalary },
      create: { employeeId, month, year, baseSalary, bonus, overtime, deductions, netSalary, status: "pending" },
    })

    return NextResponse.json(record, { status: 201 })
  } catch (err: unknown) {
    console.error("[POST /api/salary] Error:", err)
    const message = err instanceof Error ? err.message : "Failed to create salary record"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
