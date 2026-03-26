import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const employeeId = searchParams.get("employeeId")
  const month = searchParams.get("month") // "YYYY-MM"

  if (!employeeId || !month) {
    return NextResponse.json({ error: "employeeId and month required" }, { status: 400 })
  }

  const [yearStr, monthStr] = month.split("-")
  const year = parseInt(yearStr)
  const monthNum = parseInt(monthStr)

  const pad = (n: number) => n.toString().padStart(2, "0")
  const startDate = `${year}-${pad(monthNum)}-01`
  // Last day of the month
  const lastDay = new Date(year, monthNum, 0).getDate()
  const endDate = `${year}-${pad(monthNum)}-${pad(lastDay)}`

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } })
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 })

  const records = await prisma.attendance.findMany({
    where: { employeeId, date: { gte: startDate, lte: endDate } },
    orderBy: { date: "asc" },
  })

  // Build a map for quick lookup
  const recordMap = new Map(records.map((r) => [r.date, r]))

  // Generate a row for every day of the month
  const rows: string[][] = []
  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${year}-${pad(monthNum)}-${pad(day)}`
    const r = recordMap.get(dateStr)
    rows.push([
      dateStr,
      r?.checkIn ?? "--",
      r?.checkOut ?? "--",
      r?.status ?? "absent",
      r ? r.workHours.toFixed(2) : "0.00",
      r ? r.overtime.toFixed(2) : "0.00",
    ])
  }

  const headers = ["Date", "Check In", "Check Out", "Status", "Work Hours (hrs)", "Overtime (hrs)"]
  const csvLines = [
    `Employee: ${employee.name}`,
    `Department: ${employee.department}`,
    `Period: ${MONTH_NAMES[monthNum - 1]} ${year}`,
    "",
    headers.map((h) => `"${h}"`).join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    "",
    `Total Work Hours,${records.reduce((s, r) => s + r.workHours, 0).toFixed(2)}`,
    `Total Overtime,${records.reduce((s, r) => s + r.overtime, 0).toFixed(2)}`,
    `Days Present,${records.filter((r) => r.status === "present").length}`,
    `Days Absent,${lastDay - records.length}`,
  ]

  const csv = csvLines.join("\n")
  const filename = `${employee.name.replace(/\s+/g, "_")}_Attendance_${MONTH_NAMES[monthNum - 1]}_${year}.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
