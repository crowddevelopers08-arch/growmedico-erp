import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const settings = await prisma.companySettings.findUnique({ where: { id: "global" } })
  const defaults = { name: "", email: "", phone: "", address: "", website: "", timezone: "Asia/Kolkata", dateFormat: "DD/MM/YYYY", currency: "INR" }
  if (!settings) return NextResponse.json(defaults)
  const { name, email, phone, address, website, timezone, dateFormat, currency } = settings
  return NextResponse.json({ name, email, phone, address, website, timezone, dateFormat, currency })
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, email, phone, address, website, timezone, dateFormat, currency } = body
    const data = { name, email, phone, address, website, timezone, dateFormat, currency }
    const settings = await prisma.companySettings.upsert({
      where: { id: "global" },
      create: { id: "global", ...data },
      update: data,
    })
    const { name: n, email: e, phone: p, address: a, website: w, timezone: tz, dateFormat: df, currency: c } = settings
    return NextResponse.json({ name: n, email: e, phone: p, address: a, website: w, timezone: tz, dateFormat: df, currency: c })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
