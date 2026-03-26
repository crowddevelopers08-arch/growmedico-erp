import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await req.json()
    const { status, approvedBy, rejectionReason } = body

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
    }

    return NextResponse.json(request)
  } catch (err: unknown) {
    console.error("[PATCH /api/leaves/:id] Error:", err)
    const message = err instanceof Error ? err.message : "Failed to update leave request"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
