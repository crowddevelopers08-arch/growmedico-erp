import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const users = await prisma.user.findMany({
    select: {
      id: true,
      employee: { select: { id: true, name: true, avatar: true } },
    },
  })

  return NextResponse.json(
    users
      .filter((u) => u.employee)
      .map((u) => ({
        userId: u.id,
        employeeId: u.employee!.id,
        name: u.employee!.name,
        avatar: u.employee!.avatar,
      }))
  )
}
