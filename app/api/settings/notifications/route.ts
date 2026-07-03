import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const defaultNotifications = {
  emailNotifications: true,
  leaveRequests: true,
  attendanceAlerts: true,
  payrollReminders: true,
  newEmployees: false,
  weeklyReports: true,
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { preferences: true },
  })
  const prefs = (user?.preferences as Record<string, unknown>) ?? {}
  return NextResponse.json({ ...defaultNotifications, ...((prefs.notifications as object) ?? {}) })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { preferences: true },
    })
    const prefs = (user?.preferences as Record<string, unknown>) ?? {}
    await prisma.user.update({
      where: { id: session.user.id },
      data: { preferences: { ...prefs, notifications: body } },
    })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
