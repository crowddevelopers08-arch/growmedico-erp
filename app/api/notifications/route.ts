import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { notifications: true },
  })
  return NextResponse.json((user?.notifications as any[]) ?? [])
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { notifications: true },
  })
  const existing = (user?.notifications as any[]) ?? []
  const updated = existing.map((n: any) => ({ ...n, read: true }))
  await prisma.user.update({
    where: { id: session.user.id },
    data: { notifications: updated },
  })
  return NextResponse.json({ success: true })
}
