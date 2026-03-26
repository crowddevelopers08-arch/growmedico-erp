import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const employeeId = session.user.employeeId
  if (!employeeId) return NextResponse.json({ name: session.user.name ?? "", avatar: null })

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { name: true, avatar: true },
  })

  return NextResponse.json({ name: employee?.name ?? "", avatar: employee?.avatar ?? null })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { name } = await req.json()
    const employeeId = session.user.employeeId

    if (employeeId) {
      await prisma.employee.update({
        where: { id: employeeId },
        data: { name },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
