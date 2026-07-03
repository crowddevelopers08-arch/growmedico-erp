import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getAdminUserIds, notifyMany } from "@/lib/notifications"
import { leaveRequestSchema, firstIssueMessage } from "@/lib/validations"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get("employeeId")
  const status = searchParams.get("status")

  const where: Record<string, string> = {}
  if (employeeId) where.employeeId = employeeId
  if (status) where.status = status

  const requests = await prisma.leaveRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json(requests)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const parsed = leaveRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 })
    }

    const data = parsed.data
    const today = new Date().toISOString().split("T")[0]

    const request = await prisma.leaveRequest.create({
      data: { ...data, status: "pending", appliedOn: today },
    })

    const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } })
    if (employee) {
      await prisma.activity.create({
        data: {
          type: "leave",
          action: "Leave Request",
          description: `${employee.name} requested ${data.days} day${data.days > 1 ? "s" : ""} ${data.type.toLowerCase()}`,
          employeeId: data.employeeId,
        },
      })

      // Alert all admins so they can review the pending request.
      const adminIds = await getAdminUserIds()
      await notifyMany(
        adminIds.filter((id) => id !== session.user.id),
        {
          type: "leave_request",
          title: "New leave request",
          message: `${employee.name} requested ${data.days} day${data.days > 1 ? "s" : ""} ${data.type.toLowerCase()}.`,
          link: "/leaves",
        },
      )
    }

    return NextResponse.json(request, { status: 201 })
  } catch (err: unknown) {
    console.error("[POST /api/leaves] Error:", err)
    const message = err instanceof Error ? err.message : "Failed to create leave request"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
