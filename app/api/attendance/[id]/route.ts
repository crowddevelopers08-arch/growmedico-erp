import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const LATE_HOUR = 10
const LATE_MINUTE = 30
const OFFICE_HOURS = 9

function to12h(time: string) {
  const [h, m] = time.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`
}

// Parse "HH:MM" or "H:MM AM/PM" into 24h "HH:MM"
function normalize24h(time: string): string | null {
  time = time.trim()
  // Already 24h: "HH:MM"
  const h24 = time.match(/^(\d{1,2}):(\d{2})$/)
  if (h24) {
    const h = parseInt(h24[1])
    const m = parseInt(h24[2])
    if (h > 23 || m > 59) return null
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  }
  // 12h: "H:MM AM/PM"
  const h12 = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (h12) {
    let h = parseInt(h12[1])
    const m = parseInt(h12[2])
    const ampm = h12[3].toUpperCase()
    if (h < 1 || h > 12 || m > 59) return null
    if (ampm === "AM" && h === 12) h = 0
    if (ampm === "PM" && h !== 12) h += 12
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  }
  return null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { checkIn: rawCheckIn, checkOut: rawCheckOut } = body

  const existing = await prisma.attendance.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Record not found" }, { status: 404 })

  const newCheckIn = rawCheckIn ? normalize24h(rawCheckIn) : existing.checkIn
  const newCheckOut = rawCheckOut !== undefined
    ? (rawCheckOut ? normalize24h(rawCheckOut) : null)
    : existing.checkOut

  if (rawCheckIn && !newCheckIn) {
    return NextResponse.json({ error: "Invalid check-in time format" }, { status: 400 })
  }
  if (rawCheckOut && !newCheckOut) {
    return NextResponse.json({ error: "Invalid check-out time format" }, { status: 400 })
  }

  // Recalculate late status from new check-in
  let status = existing.status
  if (newCheckIn) {
    const [h, m] = newCheckIn.split(":").map(Number)
    const isLate = h > LATE_HOUR || (h === LATE_HOUR && m > LATE_MINUTE)
    status = isLate ? "late" : (existing.status === "late" ? "present" : existing.status)
  }

  // Recalculate work hours & overtime
  let workHours = existing.workHours
  let overtime = existing.overtime
  if (newCheckIn && newCheckOut) {
    const [ciH, ciM] = newCheckIn.split(":").map(Number)
    const [coH, coM] = newCheckOut.split(":").map(Number)
    workHours = Math.round(((coH + coM / 60) - (ciH + ciM / 60)) * 10) / 10
    overtime = Math.max(0, Math.round((workHours - OFFICE_HOURS) * 10) / 10)
  } else if (newCheckIn && !newCheckOut) {
    workHours = 0
    overtime = 0
  }

  const record = await prisma.attendance.update({
    where: { id },
    data: { checkIn: newCheckIn, checkOut: newCheckOut, status, workHours, overtime },
  })

  const employee = await prisma.employee.findUnique({ where: { id: existing.employeeId } })
  const parts: string[] = []
  if (newCheckIn) parts.push(`check-in → ${to12h(newCheckIn)}`)
  if (newCheckOut) parts.push(`check-out → ${to12h(newCheckOut)}`)
  await prisma.activity.create({
    data: {
      type: "attendance",
      action: "Attendance Edited",
      description: `Admin updated ${employee?.name ?? "employee"}'s attendance (${parts.join(", ")})`,
      employeeId: existing.employeeId,
    },
  })

  return NextResponse.json(record)
}
