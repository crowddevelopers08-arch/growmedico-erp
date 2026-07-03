import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// POST /api/push/subscribe  → store (or refresh) a browser push subscription
// for the current user. Keyed by endpoint so re-subscribing is idempotent.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null)
  const endpoint: string | undefined = body?.endpoint
  const p256dh: string | undefined = body?.keys?.p256dh
  const auth: string | undefined = body?.keys?.auth

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 })
  }

  const userAgent = req.headers.get("user-agent") ?? undefined

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: session.user.id, p256dh, auth, userAgent },
    create: { userId: session.user.id, endpoint, p256dh, auth, userAgent },
  })

  return NextResponse.json({ success: true })
}
