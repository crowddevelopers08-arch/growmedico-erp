import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { todayIST } from "@/lib/date"
import { isFullDayLeave, resolveLiveStatus } from "@/lib/employee-status"

// Team directory: every login grouped by account role. Built from the User
// table (left-joined to Employee) so that admin/manager logins without an
// Employee profile still show up — the plain /api/employees list would miss
// them. Live present/absent status is resolved the same way as /api/employees.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const today = todayIST()

  const [users, todayAttendance, approvedLeavesToday] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        role: true,
        employee: {
          select: {
            id: true,
            name: true,
            avatar: true,
            initials: true,
            department: true,
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
      where: { status: "approved", startDate: { lte: today }, endDate: { gte: today } },
      select: { employeeId: true, type: true },
    }),
  ])

  const attendanceByEmployee = new Map(todayAttendance.map((a) => [a.employeeId, a.status]))
  const leaveEmployeeIds = new Set(
    approvedLeavesToday.filter((l) => isFullDayLeave(l.type)).map((l) => l.employeeId)
  )

  const resolveStatus = (employeeId: string | undefined): string | null => {
    if (!employeeId) return null
    return resolveLiveStatus(attendanceByEmployee.get(employeeId), leaveEmployeeIds.has(employeeId))
  }

  const initialsFromName = (value: string) =>
    value
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || value.slice(0, 2).toUpperCase()

  return NextResponse.json(
    users.map((user) => {
      const name = user.employee?.name ?? user.email
      return {
        userId: user.id,
        employeeId: user.employee?.id ?? null,
        name,
        email: user.email,
        avatar: user.employee?.avatar ?? null,
        initials: user.employee?.initials ?? initialsFromName(name),
        department: user.employee?.department ?? null,
        jobRole: user.employee?.role ?? null,
        accountRole: user.role,
        status: resolveStatus(user.employee?.id),
      }
    })
  )
}
