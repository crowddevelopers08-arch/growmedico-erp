import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const date = searchParams.get("date")
  const employeeId = searchParams.get("employeeId")

  const where: Record<string, string> = {}
  if (date) where.date = date
  if (employeeId) where.employeeId = employeeId

  const records = await prisma.attendance.findMany({
    where,
    orderBy: { date: "desc" },
  })
  return NextResponse.json(records)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { action, employeeId } = body

  const today = new Date().toISOString().split("T")[0]
  const now = new Date()
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 })

  if (action === "checkIn") {
    const record = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date: today } },
      update: { checkIn: time, status: "present" },
      create: {
        employeeId,
        date: today,
        checkIn: time,
        checkOut: null,
        status: "present",
        workHours: 0,
        overtime: 0,
      },
    })

    await prisma.employee.update({ where: { id: employeeId }, data: { status: "present" } })
    await prisma.activity.create({
      data: {
        type: "attendance",
        action: "Check In",
        description: `${employee.name} checked in at ${time}`,
        employeeId,
      },
    })

    return NextResponse.json(record)
  }

  if (action === "checkOut") {
    const existing = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date: today } },
    })

    if (!existing?.checkIn) {
      return NextResponse.json({ error: "No check-in found for today" }, { status: 400 })
    }

    const [checkInHour, checkInMin] = existing.checkIn.split(":").map(Number)
    const [checkOutHour, checkOutMin] = time.split(":").map(Number)
    const workHours = (checkOutHour + checkOutMin / 60) - (checkInHour + checkInMin / 60)

    const record = await prisma.attendance.update({
      where: { employeeId_date: { employeeId, date: today } },
      data: {
        checkOut: time,
        workHours: Math.round(workHours * 10) / 10,
        overtime: Math.max(0, Math.round((workHours - 8) * 10) / 10),
      },
    })

    await prisma.activity.create({
      data: {
        type: "attendance",
        action: "Check Out",
        description: `${employee.name} checked out at ${time}`,
        employeeId,
      },
    })

    return NextResponse.json(record)
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
