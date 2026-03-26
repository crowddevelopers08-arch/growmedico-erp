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
    const { action } = body

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
        data: { status: "paid", paidOn: new Date().toISOString().split("T")[0] },
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
