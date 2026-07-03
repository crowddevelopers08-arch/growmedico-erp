import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// POST /api/push/unsubscribe  → remove a browser push subscription by endpoint.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const endpoint: string | undefined = body?.endpoint
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 })

  // Scope the delete to the current user so one user can't drop another's device.
  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: session.user.id },
  })

  return NextResponse.json({ success: true })
}
