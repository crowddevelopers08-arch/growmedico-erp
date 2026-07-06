import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getAdminUserIds, getUserIdForEmployee, notify, notifyMany } from "@/lib/notifications"

// Office hours: 10:00 AM – 7:00 PM (9-hour work day)
// Late threshold: check-in after 10:30 AM
const LATE_HOUR = 10
const LATE_MINUTE = 30
const OFFICE_HOURS = 9 // standard work day in hours

function to12h(time: string) {
  const [h, m] = time.split(":").map(Number)
  const ampm = h >= 12 ? "PM" : "AM"
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`
}

// Attendance is recorded in India Standard Time regardless of where the server
// runs. `new Date().getHours()` uses the server's zone (UTC in production), which
// stored afternoon IST punches as morning UTC — so derive the date and clock
// time straight from the Asia/Kolkata wall clock.
function nowIST() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date())
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "00"
  const hour = pick("hour") === "24" ? "00" : pick("hour")
  const minute = pick("minute")
  return {
    date: `${pick("year")}-${pick("month")}-${pick("day")}`,
    hours: Number(hour),
    minutes: Number(minute),
    time: `${hour}:${minute}`,
  }
}

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
  const { action, employeeId, checkInPhoto, checkOutPhoto } = body

  const { date: today, hours, minutes, time } = nowIST()

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 })

  if (action === "checkIn") {
    const isLate = hours > LATE_HOUR || (hours === LATE_HOUR && minutes > LATE_MINUTE)
    const checkInStatus = isLate ? "late" : "present"

    const record = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId, date: today } },
      update: { checkIn: time, status: checkInStatus, checkInPhoto: checkInPhoto ?? null },
      create: {
        employeeId,
        date: today,
        checkIn: time,
        checkOut: null,
        checkInPhoto: checkInPhoto ?? null,
        status: checkInStatus,
        workHours: 0,
        overtime: 0,
      },
    })

    await prisma.employee.update({ where: { id: employeeId }, data: { status: isLate ? "present" : "present" } })
    await prisma.activity.create({
      data: {
        type: "attendance",
        action: isLate ? "Late Check In" : "Check In",
        description: `${employee.name} checked in at ${to12h(time)}${isLate ? " (Late)" : ""}`,
        employeeId,
      },
    })

    // Confirm the punch to the employee, and flag late arrivals to admins.
    const employeeUserId = await getUserIdForEmployee(employeeId)
    await notify(employeeUserId ?? "", {
      type: "attendance",
      title: isLate ? "Checked in (late)" : "Checked in",
      message: `You checked in at ${to12h(time)}${isLate ? " — marked late." : "."}`,
      link: "/attendance",
    })
    if (isLate) {
      const adminIds = await getAdminUserIds()
      await notifyMany(
        adminIds.filter((id) => id !== employeeUserId),
        {
          type: "attendance_late",
          title: "Late check-in",
          message: `${employee.name} checked in late at ${to12h(time)}.`,
          link: "/attendance",
        },
      )
    }

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
        checkOutPhoto: checkOutPhoto ?? null,
        workHours: Math.round(workHours * 10) / 10,
        overtime: Math.max(0, Math.round((workHours - OFFICE_HOURS) * 10) / 10),
      },
    })

    await prisma.activity.create({
      data: {
        type: "attendance",
        action: "Check Out",
        description: `${employee.name} checked out at ${to12h(time)}`,
        employeeId,
      },
    })

    const employeeUserId = await getUserIdForEmployee(employeeId)
    if (employeeUserId) {
      await notify(employeeUserId, {
        type: "attendance",
        title: "Checked out",
        message: `You checked out at ${to12h(time)} — ${record.workHours}h logged today.`,
        link: "/attendance",
      })
    }

    return NextResponse.json(record)
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 })
}
