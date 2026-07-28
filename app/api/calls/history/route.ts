import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { callInclude, toCallRecord } from "@/lib/call/service"

/**
 * Call history for the signed-in user — every call they made or received,
 * newest first. Paginate with ?limit & ?cursor (a call id).
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const { searchParams } = new URL(req.url)
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 30, 1), 100)
  const cursor = searchParams.get("cursor")

  const rows = await prisma.call.findMany({
    where: { OR: [{ callerId: userId }, { receiverId: userId }] },
    include: callInclude,
    orderBy: { createdAt: "desc" },
    take: limit + 1, // one extra to detect the next page
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  return NextResponse.json({
    items: page.map(toCallRecord),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  })
}
