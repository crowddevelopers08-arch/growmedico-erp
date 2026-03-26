import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get("employeeId")

  const records = await prisma.salaryRecord.findMany({
    where: employeeId ? { employeeId } : undefined,
    orderBy: [{ year: "desc" }, { month: "asc" }],
  })
  return NextResponse.json(records)
}
