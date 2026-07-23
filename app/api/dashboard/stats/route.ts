import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { todayIST } from "@/lib/date"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const today = todayIST()

  const [totalEmployees, onLeaveCount, pendingRequests, todayAttendance] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { status: "onLeave" } }),
    prisma.leaveRequest.count({ where: { status: "pending" } }),
    prisma.attendance.findMany({
      where: { date: today, status: { in: ["present", "remote"] } },
    }),
  ])

  return NextResponse.json({
    totalEmployees,
    presentToday: todayAttendance.length,
    onLeave: onLeaveCount,
    pendingRequests,
  })
}
