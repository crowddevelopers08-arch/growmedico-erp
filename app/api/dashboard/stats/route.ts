import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { todayIST } from "@/lib/date"
import { isFullDayLeave, resolveLiveStatus } from "@/lib/employee-status"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const today = todayIST()

  // Resolve each employee's live status the same way /api/employees does, then
  // count. Counting attendance rows and the stored Employee.status separately
  // let the totals contradict the employees page (and never add up to the
  // headcount, since nobody was counted as absent).
  const [employees, pendingRequests, todayAttendance, approvedLeavesToday] = await Promise.all([
    prisma.employee.findMany({ select: { id: true } }),
    prisma.leaveRequest.count({ where: { status: "pending" } }),
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

  const statuses = employees.map((e) =>
    resolveLiveStatus(attendanceByEmployee.get(e.id), leaveEmployeeIds.has(e.id))
  )
  const count = (status: string) => statuses.filter((s) => s === status).length

  return NextResponse.json({
    totalEmployees: employees.length,
    // "Present today" means at work — onsite (present/late) or remote.
    presentToday: count("present") + count("remote"),
    remoteToday: count("remote"),
    onLeave: count("onLeave"),
    absentToday: count("absent"),
    pendingRequests,
  })
}
