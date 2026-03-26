import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const channels = await prisma.channel.findMany({ orderBy: { createdAt: "asc" } })
  return NextResponse.json(channels)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { name, description } = body

  if (!name?.trim()) return NextResponse.json({ error: "Channel name is required" }, { status: 400 })

  try {
    const channel = await prisma.channel.create({
      data: { name: name.trim(), description: description?.trim() ?? null, createdById: session.user.id },
    })
    return NextResponse.json(channel)
  } catch {
    return NextResponse.json({ error: "Channel name already exists" }, { status: 409 })
  }
}
