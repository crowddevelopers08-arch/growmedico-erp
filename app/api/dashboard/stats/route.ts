import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { todayIST } from "@/lib/date"
import { AT_WORK_STATUSES } from "@/lib/attendance"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const today = todayIST()

  const [totalEmployees, onLeaveCount, pendingRequests, todayAttendance] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { status: "onLeave" } }),
    prisma.leaveRequest.count({ where: { status: "pending" } }),
    prisma.attendance.findMany({
      // "late" is still present at work — count it alongside present/remote.
      where: { date: today, status: { in: [...AT_WORK_STATUSES] } },
    }),
  ])

  return NextResponse.json({
    totalEmployees,
    presentToday: todayAttendance.length,
    onLeave: onLeaveCount,
    pendingRequests,
  })
}
