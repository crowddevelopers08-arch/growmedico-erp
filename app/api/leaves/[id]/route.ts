import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUserIdForEmployee, notify } from "@/lib/notifications"
import { leaveDecisionSchema, firstIssueMessage } from "@/lib/validations"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const parsed = leaveDecisionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 })
    }
    const { status, approvedBy, rejectionReason } = parsed.data

    const updateData: Record<string, string | undefined> = { status }
    if (status === "approved") {
      updateData.approvedBy = approvedBy
      updateData.approvedOn = new Date().toISOString().split("T")[0]
    }
    if (status === "rejected" && rejectionReason) {
      updateData.rejectionReason = rejectionReason
    }

    const request = await prisma.leaveRequest.update({ where: { id }, data: updateData })

    const employee = await prisma.employee.findUnique({ where: { id: request.employeeId } })
    if (employee) {
      await prisma.activity.create({
        data: {
          type: "leave",
          action: `Leave ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          description: `${employee.name}'s ${request.type.toLowerCase()} request was ${status}`,
          employeeId: request.employeeId,
        },
      })

      // Let the requester know the outcome.
      const employeeUserId = await getUserIdForEmployee(request.employeeId)
      if (employeeUserId) {
        await notify(employeeUserId, {
          type: status === "approved" ? "leave_approved" : "leave_rejected",
          title: `Leave request ${status}`,
          message:
            status === "approved"
              ? `Your ${request.type.toLowerCase()} request was approved.`
              : `Your ${request.type.toLowerCase()} request was rejected${request.rejectionReason ? `: ${request.rejectionReason}` : "."}`,
          link: "/leaves",
        })
      }
    }

    return NextResponse.json(request)
  } catch (err: unknown) {
    console.error("[PATCH /api/leaves/:id] Error:", err)
    const message = err instanceof Error ? err.message : "Failed to update leave request"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
